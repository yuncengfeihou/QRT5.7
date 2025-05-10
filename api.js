// api.js
import * as Constants from './constants.js';
import { setMenuVisible } from './state.js'; // 假设 state.js 仍然存在且被需要

// 尝试获取 SillyTavern 上下文
// JS-Slash-Runner 在 extension_settings 中使用的键名是 "TavernHelper"
const stContext = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
const JSR_SETTINGS_KEY = "TavernHelper";
const JSR_CHAR_EXTENSION_KEY = "TavernHelper_scripts"; // JS-Slash-Runner 在角色扩展中使用的键名

/**
 * Fetches chat and global quick replies from the quickReplyApi.
 * Also fetches JS Runner buttons directly from its settings if available.
 * @returns {{ chat: Array<object>, global: Array<object> }}
 */
export function fetchQuickReplies() {
    console.log(`[${Constants.EXTENSION_NAME} Debug] fetchQuickReplies called.`);
    let chatReplies = [];
    const globalReplies = [];
    const chatQrLabels = new Set(); // To track labels and avoid duplicates in chat section

    // --- 1. 获取标准 Quick Reply v2 ---
    if (!window.quickReplyApi) {
        console.warn(`[${Constants.EXTENSION_NAME}] Quick Reply API (window.quickReplyApi) not found! Cannot fetch standard replies.`);
    } else {
        const qrApi = window.quickReplyApi;
        // 只有明确 isEnabled === false 才算禁用，undefined 或 true 都算启用
        if (qrApi.settings?.isEnabled === false) {
            console.log(`[${Constants.EXTENSION_NAME}] Core Quick Reply v2 is disabled. Skipping standard reply fetch.`);
        } else {
            console.log(`[${Constants.EXTENSION_NAME}] Fetching standard Quick Replies...`);
            try {
                // Fetch Chat Quick Replies
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
                } else {
                     console.warn(`[${Constants.EXTENSION_NAME}] Could not find chatConfig.setList in quickReplyApi settings.`);
                }

                // Fetch Global Quick Replies
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
                } else {
                     console.warn(`[${Constants.EXTENSION_NAME}] Could not find config.setList in quickReplyApi settings.`);
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

    if (typeof window.extension_settings === 'undefined') {
        console.warn(`[${Constants.EXTENSION_NAME}] Global 'window.extension_settings' not found. JS-Slash-Runner settings cannot be accessed yet.`);
    } else if (!window.extension_settings[JSR_SETTINGS_KEY]) {
        console.warn(`[${Constants.EXTENSION_NAME}] JS-Slash-Runner settings (window.extension_settings['${JSR_SETTINGS_KEY}']) not found. JS-Slash-Runner might not be loaded or enabled, or settings are not yet populated.`);
    } else {
        const jsRunnerSettings = window.extension_settings[JSR_SETTINGS_KEY];

        if (!stContext) {
             console.warn(`[${Constants.EXTENSION_NAME}] SillyTavern context (window.SillyTavern) not available. Some JS Runner button features might be limited (e.g., character scripts).`);
        }

        if (jsRunnerSettings.enabled_extension === false) { // 检查 JS-Slash-Runner 插件是否在其设置中启用
            console.log(`[${Constants.EXTENSION_NAME}] JS-Slash-Runner plugin is disabled in its settings. Skipping its button fetch.`);
        } else {
            const processScripts = (scripts, scriptType, typeEnabled) => {
                 if (!typeEnabled) {
                     console.log(`[${Constants.EXTENSION_NAME} Debug] JS-Slash-Runner ${scriptType} script type is disabled in its settings.`);
                     return;
                 }
                if (!scripts || !Array.isArray(scripts)) {
                    console.log(`[${Constants.EXTENSION_NAME} Debug] No ${scriptType} scripts found or 'scripts' is not an array in JS-Slash-Runner settings for type: ${scriptType}.`);
                    return;
                }

                scripts.forEach(script => {
                    // 检查单个脚本是否在其设置中启用且有按钮列表
                    if (script && script.enabled && script.buttons && Array.isArray(script.buttons)) {
                        script.buttons.forEach(button => {
                            // 检查按钮是否可见且有名称
                            if (button && button.visible && button.name && button.name.trim() !== "") {
                                const label = button.name.trim();
                                // 避免重复添加相同标签的按钮
                                if (!chatQrLabels.has(label)) {
                                    chatReplies.push({
                                        setName: script.name || 'JS脚本', // 使用脚本名作为分类或默认名
                                        label: label,
                                        message: `(JS脚本: ${script.name || '未命名'})`, // 内部描述
                                        isStandard: false, // 标记为非标准QR，而是JS Runner代理
                                        scriptId: script.id, // 存储脚本ID用于后续事件触发
                                        source: 'JSSlashRunner' // 额外标识来源
                                    });
                                    chatQrLabels.add(label);
                                }
                            }
                        });
                    }
                });
            };

            // 处理全局脚本
            // 默认启用，除非明确设置为 false
            const globalScriptEnabled = jsRunnerSettings.script?.global_script_enabled !== false;
            processScripts(jsRunnerSettings.script?.scriptsRepository, 'global', globalScriptEnabled);

            // 处理角色脚本
            if (stContext && stContext.characters && typeof stContext.this_chid !== 'undefined' && stContext.this_chid !== null) {
                const currentChar = stContext.characters[stContext.this_chid];
                if (currentChar && currentChar.avatar) {
                    // 默认启用角色脚本类型，除非明确设置为 false
                    const characterScriptsTypeEnabled = jsRunnerSettings.script?.characters_with_scripts_enabled !== false;
                    const characterEnabledList = Array.isArray(jsRunnerSettings.script?.characters_with_scripts) ? jsRunnerSettings.script.characters_with_scripts : [];
                    const isCurrentCharEnabledForScripts = characterEnabledList.includes(currentChar.avatar);

                    if (characterScriptsTypeEnabled && isCurrentCharEnabledForScripts) {
                        const characterScripts = currentChar.data?.extensions?.[JSR_CHAR_EXTENSION_KEY];
                        processScripts(characterScripts, 'character', true); // 角色类型已启用且当前角色在列表中，则处理其脚本
                    } else {
                        console.log(`[${Constants.EXTENSION_NAME} Debug] JS-Slash-Runner character scripts are disabled for current character (Type enabled: ${characterScriptsTypeEnabled}, Current char in list: ${isCurrentCharEnabledForScripts}).`);
                    }
                } else {
                     console.log(`[${Constants.EXTENSION_NAME} Debug] No character selected or character data incomplete for JS Runner character scripts.`);
                }
            } else {
                 console.log(`[${Constants.EXTENSION_NAME} Debug] SillyTavern context does not indicate a character is selected for JS Runner character scripts.`);
            }
             const jsRunnerChatCount = chatReplies.filter(r => r.source === 'JSSlashRunner').length;
             if (jsRunnerChatCount > 0) { // 只在实际获取到按钮时打印成功信息
                console.log(`[${Constants.EXTENSION_NAME}] Successfully fetched ${jsRunnerChatCount} JS Runner buttons.`);
             } else if (jsRunnerSettings.enabled_extension !== false) { // 如果插件启用了但没获取到按钮
                console.log(`[${Constants.EXTENSION_NAME}] No JS Runner buttons found (or all were duplicates/disabled/not configured).`);
             }
        }
    }
    // --- JS Runner 按钮获取结束 ---

    console.log(`[${Constants.EXTENSION_NAME} Debug] Final fetch results - Chat (incl. JS): ${chatReplies.length}, Global: ${globalReplies.length}`);
    return { chat: chatReplies, global: globalReplies };
}


/**
 * Triggers a specific standard quick reply using the API.
 * (此函数只处理 isStandard: true 的情况，由 event handler 决定调用)
 * @param {string} setName
 * @param {string} label
 */
export async function triggerQuickReply(setName, label) {
    if (!window.quickReplyApi) {
        console.error(`[${Constants.EXTENSION_NAME}] Quick Reply API not found! Cannot trigger standard reply.`);
        return;
    }
    // 只有明确 isEnabled === false 才算禁用
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

/**
 * Triggers a specific JS-Slash-Runner script button via its event.
 * (此函数只处理 isStandard: false 的情况)
 * @param {string} scriptId - The ID of the script.
 * @param {string} buttonLabel - The label of the button within the script.
 */
export async function triggerJsRunnerScript(scriptId, buttonLabel) {
    // 确保 SillyTavern 上下文和 eventSource 可用
    if (!stContext || !stContext.eventSource || typeof stContext.eventSource.emit !== 'function') {
        console.error(`[${Constants.EXTENSION_NAME}] SillyTavern context or eventSource not available. Cannot trigger JS Runner script.`);
        return;
    }

    // 检查 JS-Slash-Runner 插件是否在其设置中启用
    const jsRunnerSettings = window.extension_settings?.[JSR_SETTINGS_KEY];
    if (!jsRunnerSettings || jsRunnerSettings.enabled_extension === false) {
        console.log(`[${Constants.EXTENSION_NAME}] JS-Slash-Runner plugin is disabled in its settings. Cannot trigger script event.`);
        return;
    }

    // 构造 JS-Slash-Runner 按钮事件名
    const eventName = `${scriptId}_${buttonLabel}`;
    console.log(`[${Constants.EXTENSION_NAME}] Triggering JS Runner Script: Event='${eventName}' (ScriptID='${scriptId}', Button='${buttonLabel}')`);

    try {
        // 使用 SillyTavern 的 eventSource 发射事件
        await stContext.eventSource.emit(eventName);
        console.log(`[${Constants.EXTENSION_NAME}] JS Runner script event "${eventName}" emitted successfully.`);
    } catch (error) {
        console.error(`[${Constants.EXTENSION_NAME}] Error emitting JS Runner script event "${eventName}":`, error);
    }
}
