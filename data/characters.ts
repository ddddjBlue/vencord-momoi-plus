/*
 * Vencord, a Discord client mod
 * Copyright (c) 2025 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

export interface Character {
    label: string;
    icon: string;
    aliases?: string[];
    // keyword source when the id itself does not spell it, e.g. "moy?ai"
    pattern?: string;
    // literal characters that match without any surrounding emoji, e.g. the moyai emoji
    literal?: string;
}

// Single source of truth for every trigger. Adding a character here covers
// labels, icons and toggles; its audio still has to be added to the pipeline
// (convert_audio.py), which fails loudly when the two disagree.
export const CHARACTERS: Record<string, Character> = {
    momoi: { label: "Momoi", icon: "https://cdn.discordapp.com/emojis/1246008877078679633.webp?size=240", aliases: ["モモイ"] },
    reisa: { label: "Reisa", icon: "https://cdn.discordapp.com/emojis/1210653986886127626.webp?size=240&animated=true", aliases: ["レイサ"] },
    nozomi: { label: "Nozomi", icon: "https://cdn.discordapp.com/emojis/1251953167781072956.webp?size=240&animated=true", aliases: ["ノゾミ"] },
    hikari: { label: "Hikari", icon: "https://cdn.discordapp.com/emojis/1232176042740027472.webp?size=240&animated=true", aliases: ["ヒカリ"] },
    aoba: { label: "Aoba", icon: "https://cdn.discordapp.com/emojis/1385233062111084634.webp?size=240&animated=true", aliases: ["アオバ"] },
    miyu: { label: "Miyu", icon: "https://cdn.discordapp.com/emojis/1067053687484186715.webp?size=240&animated=true", aliases: ["ミユ"] },
    koyuki: { label: "Koyuki", icon: "https://cdn.discordapp.com/emojis/1263453091727016150.webp?size=240", aliases: ["コユキ"] },
    aris: { label: "Aris", icon: "https://cdn.discordapp.com/emojis/1124345097874591764.webp?size=240&animated=true", aliases: ["アリス", "Arisu"] },
    aru: { label: "Aru", icon: "https://cdn.discordapp.com/emojis/1148593778471485451.webp?size=240&animated=true", aliases: ["アル"] },
    arona: { label: "Arona", icon: "https://cdn.discordapp.com/emojis/1015884937175519263.webp?size=240&animated=true", aliases: ["アロナ"] },
    atsuko: { label: "Atsuko", icon: "https://cdn.discordapp.com/emojis/1214618973795262474.webp?size=240&animated=true", aliases: ["アツコ"] },
    mika: { label: "Mika", icon: "https://cdn.discordapp.com/emojis/1078961732367679558.webp?size=240&animated=true", aliases: ["ミカ"] },
    shiroko: { label: "Shiroko", icon: "https://cdn.discordapp.com/emojis/803779495638859797.webp?size=240&animated=true", aliases: ["シロコ"] },
    koharu: { label: "Koharu", icon: "https://cdn.discordapp.com/emojis/1291829031985217630.webp?size=240&animated=true", aliases: ["コハル"] },
    yuuka: { label: "Yuuka", icon: "https://cdn.discordapp.com/emojis/1272143959291986020.webp?size=240&animated=true", aliases: ["ユウカ"] },
    kei: { label: "Kei", icon: "https://cdn.discordapp.com/emojis/1467162062286356490.webp?size=240&animated=true", aliases: ["ケイ"] },
    erika: { label: "Erika", icon: "https://cdn.discordapp.com/emojis/1337996720805515274.webp?size=240", aliases: ["エリカ"] },
    izuna: { label: "Izuna", icon: "https://cdn.discordapp.com/emojis/1028641400717320352.webp?size=240&animated=true", aliases: ["イズナ"] },
    kanoe: { label: "Kanoe", icon: "https://cdn.discordapp.com/emojis/1421035859775586326.webp?size=240", aliases: ["カノエ"] },
    otogi: { label: "Otogi", icon: "https://cdn.discordapp.com/emojis/1280029378738262047.webp?size=240&animated=true", aliases: ["オトギ"] },
    rana: { label: "Rana", icon: "https://cdn.discordapp.com/emojis/1563917358031048836.webp?size=240", aliases: ["ラナ"] },
    rena: { label: "Rena", icon: "https://cdn.discordapp.com/emojis/1421039651745038417.webp?size=240", aliases: ["レナ"] },
    eri: { label: "Eri", icon: "https://cdn.discordapp.com/emojis/1426086010051104808.webp?size=240&animated=true", aliases: ["エリ"] },
    konoka: { label: "Konoka", icon: "https://cdn.discordapp.com/emojis/1301556621205569586.webp?size=240", aliases: ["コノカ"] },
    moyai: { label: "Moyai", icon: "https://discord.com/assets/845fa5845c2e5e7d.svg", aliases: ["モアイ", "moai", "🗿"], pattern: "moy?ai", literal: "🗿" },
};

// Helper to build a case-insensitive pattern string, e.g., "aris" -> "[aA][rR][iI][sS]"
function createCaseInsensitivePattern(keyword: string): string {
    return keyword.split("").map(char => {
        const lower = char.toLowerCase();
        const upper = char.toUpperCase();
        return lower === upper ? char : `[${lower}${upper}]`;
    }).join("");
}

// Builds precise regex patterns that avoid partial word matches. Matches custom
// emoji shortcodes (:aris_x:) and emoji/sticker URLs (?name=aris_x), not plain text.
function createKeywordRegex(id: string, { pattern, literal }: Character): RegExp {
    const boundary = `(?<![a-zA-Z])${createCaseInsensitivePattern(pattern ?? id)}(?![a-z])`;
    const shortcodePattern = `:[^:]*?${boundary}[^:]*?:`;
    const urlPattern = `https?:\\/\\/(?:cdn\\.discordapp\\.com\\/emojis|media\\.discordapp\\.net\\/stickers)\\/\\d+\\.(?:png|webp|gif)\\?[^ ]*?name=[^&]*?${boundary}[^&]*`;

    return new RegExp([literal, shortcodePattern, urlPattern].filter(Boolean).join("|"), "g");
}

const entries = Object.entries(CHARACTERS);

// Deliberately no 'i' flag: case-insensitivity is built into the patterns.
export const KEYWORD_REGEX: Record<string, RegExp> = Object.fromEntries(entries.map(([id, character]) => [id, createKeywordRegex(id, character)]));
export const KEYWORD_ALIASES: Record<string, string[]> = Object.fromEntries(entries.map(([id, character]) => [id, character.aliases ?? []]));
export const labels: Record<string, string> = Object.fromEntries(entries.map(([id, character]) => [id, character.label]));
export const ICON_BASE64: Record<string, string> = Object.fromEntries(entries.map(([id, character]) => [id, character.icon]));
export const toggleableKeywords = entries.map(([id]) => id).filter(id => id !== "momoi");
