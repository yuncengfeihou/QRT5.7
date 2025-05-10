// api.js
import * as Constants from './constants.js';
import { setMenuVisible } from './state.js';

const stContext = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
const JSR_SETTINGS_KEY = "TavernHelper";
const JSR_CHAR_EXTENSION_KEY = "TavernHelper_scripts";

/**
 * Fetches chat and global quick replies from the quickReplyApi.
 * Also fetches JS Runner buttons directly from its settings if available.
 * @returns {{ chat: Array<object>, global: Array<object> }}
 */
export function fetchQuickReplies() {
    console.log(`[${Constants.EXTENSION_NAME} Debug] fetchQuickReplies called.`);
    let chatReplies = [];
    const globalReplies = [];
    const chatQrLabels = new Set();

    // --- 1. 获取标准 Quick Reply v2 ---
    // (保持你原有的获取标准QR的代码)
    if (!window.quickReplyApi) {
        console.warn(`[${Constants.EXTENSION_NAME}] Quick Reply API (window.quickReplyApi) not found! Cannot fetch standard replies.`);
    } else {
        const qrApi = window.quickReplyApi;
        if (qrApi.settings?.isEnabled === false) {
            console.log(`[${Constants.EXTENSION_NAME}] Core Quick Reply v2 is disabled. Skipping standard reply fetch.`);
        } else {
            console.log(`[${Constants.EXTENSION_NAME}] Fetching standard Quick Replies...`);
            try {
                if (qrApi.settings?.chatConfig?.setList) {
                    qrApi.settings.chatConfig.setList.forEach(setLink => {
                        if (setLink?.isVisible && setLink.set?.qrList && Array.isArray(setLink.set.qrList)) {
                            setLink.set.qrList.forEach(qr => {
                                if (qr && !qr.isHidden && qr.label && qr.label.trim() !== "") {
                                    const label = qr.label.trim();
                                    if (!chatQrLabels.has(label)) {
                                        chatReplies.push({
                                            setName: setLink.set.name || 'Unknown Set',
                                            label: label,
                                            message: qr.message || `(标准回复: ${label})`,
                                            isStandard: true,
                                            source: 'QuickReplyV2'
                                        });
                                        chatQrLabels.add(label);
                                    }
                                }
                            });
                        }
                    });
                }

                if (qrApi.settings?.config?.setList) {
                    qrApi.settings.config.setList.forEach(setLink => {
                        if (setLink?.isVisible && setLink.set?.qrList && Array.isArray(setLink.set.qrList)) {
                            setLink.set.qrList.forEach(qr => {
                                if (qr && !qr.isHidden && qr.label && qr.label.trim() !== "") {
                                     const label = qr.label.trim();
                                    if (!chatQrLabels.has(label)) {
                                        globalReplies.push({
                                            setName: setLink.set.name || 'Unknown Set',
                                            label: label,
                                            message: qr.message || `(标准回复: ${label})`,
                                            isStandard: true,
                                            source: 'QuickReplyV2'
                                        });
                                    }
                                }
                            });
                        }
                    });
                }
                const standardChatCount = chatReplies.filter(r => r.source === 'QuickReplyV2').length;
                console.log(`[${Constants.EXTENSION_NAME}] Fetched Standard Replies - Chat: ${standardChatCount}, Global: ${globalReplies.length}`);
            } catch (error) {
                console.error(`[${Constants.EXTENSION_NAME}] Error fetching standard quick replies:`, error);
            }
        }
    }

    // --- 2. 从 JS-Slash-Runner 设置中获取脚本按钮 ---
    console.log(`[${Constants.EXTENSION_NAME} Debug] Attempting to fetch JS Runner buttons from settings...`);

    // 检查 window.extension_settings 和 window.extension_settings[JSR_SETTINGS_KEY] 是否存在
    if (typeof window.extension_settings === 'undefined') {
        console.warn(`[${Constants.EXTENSION_NAME}] Global 'window.extension_settings' not found. JS-Slash-Runner settings cannot be accessed yet.`);
    } else if (!window.extension_settings[JSR_SETTINGS_KEY]) {
        console.warn(`[${Constants.EXTENSION_NAME}] JS-Slash-Runner settings (window.extension_settings['${JSR_SETTINGS_KEY}']) not found. JS-Slash-Runner might not be loaded or enabled.`);
    } else {
        const jsRunnerSettings = window.extension_settings[JSR_SETTINGS_KEY];

        if (!stContext) {
             console.warn(`[${Constants.EXTENSION_NAME}] SillyTavern context (window.SillyTavern) not available. Some JS Runner button features might be limited.`);
        }

        if (jsRunnerSettings.enabled_extension === false) {
            console.log(`[${Constants.EXTENSION_NAME}] JS-Slash-Runner plugin is disabled in its settings. Skipping its button fetch.`);
        } else {
            const processScripts = (scripts, scriptType, typeEnabled) => {
                 if (!typeEnabled) {
                     console.log(`[${Constants.EXTENSION_NAME} Debug] JS-Slash-Runner ${scriptType} script type is disabled.`);
                     return;
                 }
                if (!scripts || !Array.isArray(scripts)) {
                    console.log(`[${Constants.EXTENSION_NAME} Debug] No ${scriptType} scripts found or scripts is not an array in JS-Slash-Runner settings.`);
                    return;
                }

                scripts.forEach(script => {
                    if (script && script.enabled && script.buttons && Array.isArray(script.buttons)) {
                        script.buttons.forEach(button => {
                            if (button && button.visible && button.name && button.name.trim() !== "") {
                                const label = button.name.trim();
                                if (!chatQrLabels.has(label)) {
                                    chatReplies.push({
                                        setName: script.name || 'JS脚本',
                                        label: label,
                                        message: `(JS脚本: ${script.name || '未命名'})`,
                                        isStandard: false,
                                        scriptId: script.id,
                                        source: 'JSSlashRunner'
                                    });
                                    chatQrLabels.add(label);
                                }
                            }
                        });
                    }
                });
            };

            const globalScriptEnabled = jsRunnerSettings.script?.global_script_enabled !== false;
            processScripts(jsRunnerSettings.script?.scriptsRepository, 'global', globalScriptEnabled);

            if (stContext && stContext.characters && typeof stContext.this_chid !== 'undefined' && stContext.this_chid !== null) {
                const currentChar = stContext.characters[stContext.this_chid];
                if (currentChar && currentChar.avatar) {
                    const characterScriptsTypeEnabled = jsRunnerSettings.script?.characters_with_scripts_enabled !== false;
                    const characterEnabledList = Array.isArray(jsRunnerSettings.script?.characters_with_scripts) ? jsRunnerSettings.script.characters_with_scripts : [];
                    const isCurrentCharEnabled = characterEnabledList.includes(currentChar.avatar);

                    if (characterScriptsTypeEnabled && isCurrentCharEnabled) {
                        const characterScripts = currentChar.data?.extensions?.[JSR_CHAR_EXTENSION_KEY];
                        processScripts(characterScripts, 'character', true);
                    } else {
                        console.log(`[${Constants.EXTENSION_NAME} Debug] JS-Slash-Runner character scripts are disabled for current character (Type enabled: ${characterScriptsTypeEnabled}, Current char in list: ${isCurrentCharEnabled}).`);
                    }
                } else {
                     console.log(`[${Constants.EXTENSION_NAME} Debug] No character selected or character data incomplete for JS Runner character scripts.`);
                }
            } else {
                 console.log(`[${Constants.EXTENSION_NAME} Debug] SillyTavern context does not indicate a character is selected for JS Runner character scripts.`);
            }
             const jsRunnerChatCount = chatReplies.filter(r => r.source === 'JSSlashRunner').length;
             if (jsRunnerChatCount > 0) {
                console.log(`[${Constants.EXTENSION_NAME}] Successfully fetched ${jsRunnerChatCount} JS Runner buttons.`);
             } else if (jsRunnerSettings.enabled_extension !== false) {
                console.log(`[${Constants.EXTENSION_NAME}] No JS Runner buttons found or all were duplicates/disabled.`);
             }
        }
    }
    // --- JS Runner 按钮获取结束 ---

    console.log(`[${Constants.EXTENSION_NAME} Debug] Final fetch results - Chat (incl. JS): ${chatReplies.length}, Global: ${globalReplies.length}`);
    return { chat: chatReplies, global: globalReplies };
}

// triggerQuickReply 和 triggerJsRunnerScript 函数保持不变
// ... (triggerQuickReply 和 triggerJsRunnerScript)
export async function triggerQuickReply(setName, label) {
    if (!window.quickReplyApi) {
        console.error(`[${Constants.EXTENSION_NAME}] Quick Reply API not found! Cannot trigger standard reply.`);
        return;
    }
    if (window.quickReplyApi.settings?.isEnabled === false) {
         console.log(`[${Constants.EXTENSION_NAME}] Core Quick Reply v2 is disabled. Cannot trigger standard reply.`);
         return;
    }

    console.log(`[${Constants.EXTENSION_NAME}] Triggering Standard Quick Reply: "${setName}.${label}"`);
    try {
        await window.quickReplyApi.executeQuickReply(setName, label);
        console.log(`[${Constants.EXTENSION_NAME}] Standard Quick Reply "${setName}.${label}" executed successfully.`);
    } catch (error) {
        console.error(`[${Constants.EXTENSION_NAME}] Failed to execute Standard Quick Reply "${setName}.${label}":`, error);
    }
}

export async function triggerJsRunnerScript(scriptId, buttonLabel) {
    if (!stContext || !stContext.eventSource || typeof stContext.eventSource.emit !== 'function') {
        console.error(`[${Constants.EXTENSION_NAME}] SillyTavern context or eventSource not available. Cannot trigger JS Runner script.`);
        return;
    }

    const jsRunnerSettings = window.extension_settings?.[JSR_SETTINGS_KEY];
    if (!jsRunnerSettings || jsRunnerSettings.enabled_extension === false) {
        console.log(`[${Constants.EXTENSION_NAME}] JS-Slash-Runner plugin is disabled. Cannot trigger script event.`);
        return;
    }

    const eventName = `${scriptId}_${buttonLabel}`;
    console.log(`[${Constants.EXTENSION_NAME}] Triggering JS Runner Script: Event='${eventName}' (ScriptID='${scriptId}', Button='${buttonLabel}')`);

    try {
        await stContext.eventSource.emit(eventName);
        console.log(`[${Constants.EXTENSION_NAME}] JS Runner script event "${eventName}" emitted successfully.`);
    } catch (error) {
        console.error(`[${Constants.EXTENSION_NAME}] Error emitting JS Runner script event "${eventName}":`, error);
    }
}
