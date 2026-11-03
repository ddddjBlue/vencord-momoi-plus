/*
 * Vencord, a Discord client mod
 * Copyright (c) 2023 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { useSettings } from "@api/Settings";
import { classNameFactory } from "@api/Styles";
import { Button } from "@components/Button";
import { Flex } from "@components/Flex";
import { Text } from "@components/Text";
import { Clickable } from "@webpack/common";

import { ICON_BASE64, labels, toggleableKeywords } from "../data/characters";
import { recruit, settings } from "../index";

const cl = classNameFactory("vc-momoiPlus-");

function renderSwitch(keyword: string, isDisabled: boolean, handleToggle: () => void) {
    const characterClass = isDisabled ? `${cl("Character")} disabled` : cl("Character");

    return (
        <Clickable
            onClick={handleToggle}
        >
            <Flex className={characterClass}>
                <img
                    src={ICON_BASE64[keyword]}
                />
                <Text size="lg" weight="semibold">
                    {labels[keyword]}
                </Text>
            </Flex>
        </Clickable>
    );
}

export function ExtrasComponent() {
    useSettings(["plugins.MomoiPlus.triggerToggles.*"]);
    function handleToggle(keyword: string): void {
        if (!settings.store.triggerToggles[keyword]) {
            settings.store.triggerToggles[keyword] = true;
        }
        else {
            settings.store.triggerToggles[keyword] = false;
        }
    }

    // The stored value is inverted: true means the trigger is muted
    function setAll(muted: boolean): void {
        settings.store.triggerToggles = Object.fromEntries(toggleableKeywords.map(keyword => [keyword, muted]));
    }

    return (
        <div className={cl("extrasComponent")}>
            <Text size="xl" weight="semibold">Extras</Text>
            <Flex alignItems="center" justifyContent="space-between" flexWrap="wrap" gap="0.5em">
                <Text size="sm">To pat, or not to pat</Text>
                <Flex gap="0.5em">
                    <Button className={cl("extrasAction")} variant="none" size="xs" onClick={recruit}>Recruit</Button>
                    <Button className={cl("extrasAction")} variant="none" size="xs" onClick={() => setAll(false)}>Pat all</Button>
                    <Button className={cl("extrasAction")} variant="none" size="xs" onClick={() => setAll(true)}>Pat none</Button>
                </Flex>
            </Flex>
            <Flex className={cl("CharacterList")}>
                {[...toggleableKeywords].sort((a, b) => labels[a].localeCompare(labels[b])).map(keyword => (
                    <div key={keyword}>
                        {renderSwitch(keyword, settings.store.triggerToggles[keyword], () => handleToggle(keyword))}
                    </div>
                ))}
            </Flex>
        </div>
    );
}
