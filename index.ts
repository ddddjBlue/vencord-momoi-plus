/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./momoi-plus.css";

import { definePluginSettings } from "@api/Settings";
import { sleep } from "@utils/misc";
import definePlugin, { OptionType, PluginAuthor } from "@utils/types";
import { RelationshipStore, SelectedChannelStore, UserStore } from "@webpack/common";

import { EXTRA_KEYWORD_BASE64, MOMOI_BASE64 } from "./data/audioData";
import { KEYWORD_ALIASES, KEYWORD_REGEX } from "./data/keywordData";
import { ExtrasComponent } from "./settings/extrasSettings";

// Local implementation of makeRange
function makeRange(start: number, end: number, step: number): number[] {
    const arr: number[] = [];
    for (let i = start; i <= end; i = Math.round((i + step) * 1e12) / 1e12) {
        arr.push(i);
    }
    return arr;
}

// Helper to build a case-insensitive pattern string, e.g., "aris" -> "[aA][rR][iI][sS]"
function createCaseInsensitivePattern(keyword: string): string {
    return keyword.split('').map(char => {
        const lower = char.toLowerCase();
        const upper = char.toUpperCase();
        return lower === upper ? char : `[${lower}${upper}]`;
    }).join('');
}

// Helper function to check for whole-word matches in names, respecting camelCase and underscores.
function nameMatchesKeyword(name: string, keyword: string, aliases: string[]): boolean {
    const allTerms = [keyword, ...aliases.map(a => a.toLowerCase())];
    const nameLower = name.toLowerCase();

    for (const term of allTerms) {
        let startIndex = -1;
        while ((startIndex = nameLower.indexOf(term, startIndex + 1)) !== -1) {
            const beforeOk = startIndex === 0 || !/[a-z]/.test(name[startIndex - 1]);
            const afterIndex = startIndex + term.length;
            const afterOk = afterIndex === name.length || !/[a-z]/.test(name[afterIndex]);

            if (beforeOk && afterOk) return true;
        }
    }
    return false;
}


// Local type definitions
type StickerItem = { id: string; name: string; format_type: number; };
type Message = { id: string; content: string; author?: { id: string; bot?: boolean; }; state?: string; sticker_items?: StickerItem[]; };
type ReactionEmoji = { id?: string; name: string; animated?: boolean; };
interface IMessageCreate { type: "MESSAGE_CREATE"; optimistic: boolean; channelId: string; message: Message; }
interface IReactionAdd { type: "MESSAGE_REACTION_ADD"; optimistic: boolean; channelId: string; userId: string; messageAuthorId: string; emoji: ReactionEmoji; }
interface IVoiceChannelEffectSendEvent { type: string; emoji?: ReactionEmoji; }


export const settings = definePluginSettings({
    volume: { description: "Playback volume", type: OptionType.SLIDER, markers: makeRange(0, 1, 0.1), default: 0.5, stickToMarkers: false },
    voice: { description: "Select Your Momoi", type: OptionType.SELECT, options: [{ label: "Kuyashi", value: "kuyashi", default: true }, { label: "Tasukete", value: "tasukete" }, { label: "Yurusenai", value: "yurusenai" }] },
    startupSound: {
        description: "Replace Discord's startup sound",
        type: OptionType.SELECT,
        options: [
            { label: "Don't Replace", value: "none", default: true },
            { label: "Selected Momoi", value: "momoi" },
            { label: "Random Sound", value: "random" }
        ]
    },
    triggerWhenUnfocused: { description: "Trigger even when unfocused", type: OptionType.BOOLEAN, default: true },
    ignoreBots: { description: "Ignore bot users", type: OptionType.BOOLEAN, default: true },
    ignoreBlocked: { description: "Ignore blocked users", type: OptionType.BOOLEAN, default: true },
    triggerToggles: {
        type: OptionType.COMPONENT,
        default: {} as Record<string, boolean>,
        component: ExtrasComponent,
    },
});

// --- PLUGIN DEFINITION ---
const customAuthors: PluginAuthor[] = [
    { name: "Nin", id: 1286362631984255162n },
    { name: "JoubaMety", id: 266528098772713474n }
];
const ALL_EXTRA_SOUNDS = Object.values(EXTRA_KEYWORD_BASE64).flat();

export default definePlugin({
    name: "MomoiPlus",
    authors: customAuthors,
    description: "Life, is Kuyashi.",
    settings,
    patches: [
        {
            // Reference: https://github.com/JoubaMety/vencord-momoi-plus/commit/15d66176f881b1e72a0adc940d3572287ab8101a#diff-dcdc3e0b3362edb8fec2a51d3fa51f8fb8af8f70247e06d9887fa934834c9122R84
            find: "cb85be48267eb1b4.mp3",
            replacement: {
                match: /e\.exports=n\.p\+"[a-zA-Z0-9]+\.mp3"/,
                replace: "e.exports=$getDataUrl($self.settings.store.startupSound)",
                predicate: () => settings.store.startupSound !== "none"
            }
        },
        {
            // Targets the audio element creation and volume setting
            find: /\("discodo",(\w+)\);return (\w+)\.volume=1,\2\}/,
            replacement: {
                match: /\("discodo",(\w+)\);return (\w+)\.volume=1,\2\}/,
                replace: '("discodo",$1);return $2.volume=window.$getMomoiVolume(),$2}'
            }
        },
        {
            // This targets: this._connectedSound.volume = 1
            // Stopping the Constructor from resetting it to 1
            find: "this._connectedSound.volume=1",
            replacement: {
                match: /this\._connectedSound\.volume=1/g,
                replace: "this._connectedSound.volume=window.$getMomoiVolume()"
            }
        }
    ],
    flux: {
        async MESSAGE_CREATE({ optimistic, message, channelId }: IMessageCreate) {
            if (optimistic || message.state === "SENDING" || (settings.store.ignoreBots && message.author?.bot) || (settings.store.ignoreBlocked && (message.author?.id) && RelationshipStore.isBlocked(message.author?.id)) || channelId !== SelectedChannelStore.getChannelId() || (!message.content && !message.sticker_items?.length)) return;

            for (const key of Object.keys(KEYWORD_REGEX)) {
                if (key !== "momoi" && settings.store.triggerToggles[key]) continue;
                let matchCount = 0;
                if (message.content) {
                    const contentMatches = message.content.match(KEYWORD_REGEX[key]);
                    if (contentMatches) matchCount += contentMatches.length;
                }
                if (message.sticker_items) {
                    for (const sticker of message.sticker_items) {
                        if (nameMatchesKeyword(sticker.name, key, KEYWORD_ALIASES[key] ?? [])) {
                            matchCount++;
                        }
                    }
                }
                if (matchCount > 0) {
                    for (let i = 0; i < matchCount; i++) {
                        playKeyword(key);
                        await sleep(300);
                    }
                }
            }
        },
        MESSAGE_REACTION_ADD({ optimistic, channelId, userId, messageAuthorId, emoji }: IReactionAdd) {
            if (optimistic || (settings.store.ignoreBots && UserStore.getUser(userId)?.bot) || (settings.store.ignoreBlocked && RelationshipStore.isBlocked(messageAuthorId)) || channelId !== SelectedChannelStore.getChannelId()) return;

            for (const key of Object.keys(KEYWORD_REGEX)) {

                if (key !== "momoi" && settings.store.triggerToggles[key]) continue;
                if (nameMatchesKeyword(emoji.name, key, KEYWORD_ALIASES[key] ?? [])) {
                    playKeyword(key);
                }
            }
        },
        VOICE_CHANNEL_EFFECT_SEND({ emoji }: IVoiceChannelEffectSendEvent) {
            if (!emoji?.name) return;
            for (const key of Object.keys(KEYWORD_REGEX)) {
                if (key !== "momoi" && settings.store.triggerToggles[key]) continue;
                if (nameMatchesKeyword(emoji.name, key, KEYWORD_ALIASES[key] ?? [])) {
                    playKeyword(key);
                }
            }
        }
    }
});

function getDataUrl(key: string) {
    let base64String: string | undefined;

    if (key === "momoi") {
        const voices = Array.isArray(settings.store.voice) ? settings.store.voice : [settings.store.voice];
        base64String = voices.map(v => MOMOI_BASE64[v]).filter(Boolean)[0];
    } else if (key === "random") {
        const allMomoiSounds = Object.values(MOMOI_BASE64);
        const allSounds = [...allMomoiSounds, ...ALL_EXTRA_SOUNDS];
        const randomIndex = Math.floor(Math.random() * allSounds.length);
        base64String = allSounds[randomIndex];
    } else {
        const extra = EXTRA_KEYWORD_BASE64[key];
        if (Array.isArray(extra)) {
            const idx = Math.floor(Math.random() * extra.length);
            if (extra[idx]) base64String = extra[idx];
        } else if (extra) {
            base64String = extra as string;
        }
    }

    return base64String ? `data:audio/ogg;base64,${base64String}` : "";
}
(window as any).$getDataUrl = getDataUrl;

async function playKeyword(key: string) {
    if (!settings.store.triggerWhenUnfocused && !document.hasFocus()) return;

    const dataUrl = getDataUrl(key);

    if (!dataUrl) return;

    try {
        const response = await fetch(dataUrl);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const audio = document.createElement("audio");
        audio.src = blobUrl;
        audio.volume = settings.store.volume;
        audio.onended = () => URL.revokeObjectURL(blobUrl);
        audio.onerror = () => URL.revokeObjectURL(blobUrl);
        audio.play();
    } catch (error) {
        console.error(`[MomoiPlus] Error playing Base64 audio for key ${key}:`, error);
    }
}

(window as any).$getMomoiVolume = () => {
    const vol = settings.store.volume;
    console.log("[MomoiPlus] Startup volume set to:", vol);
    return (typeof vol === 'number') ? vol : 0.5;
};