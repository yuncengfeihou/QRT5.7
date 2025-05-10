// api.js
import * as Constants from './constants.js';
import { setMenuVisible } from './state.js'; // 假设 state.js 仍然存在且被需要

/**
 * Fetches chat and global quick replies from the quickReplyApi.
 * Checks if the main Quick Reply v2 extension is enabled before fetching.
 * Also scans for JS Runner buttons and adds them to chat replies.
 * @returns {{ chat: Array<object>, global: Array<object> }}
 */
export function fetchQuickReplies() {
    console.log(`[${Constants.EXTENSION_NAME} Debug] fetchQuickReplies called.`);
    let chatReplies = [];
    const globalReplies = [];
    const chatQrLabels = new Set(); // To track labels and avoid duplicates in chat section

    // --- 检查 Quick Reply API ---
    if (!window.quickReplyApi) {
        console.error(`[${Constants.EXTENSION_NAME}] Quick Reply API (window.quickReplyApi) not found! Cannot fetch standard replies.`);
        // 即使 API 不存在，仍然尝试扫描 JS Runner
    } else {
        // --- 获取标准 Quick Reply (仅当 API 存在且启用时) ---
        const qrApi = window.quickReplyApi;
        // 注意：我们假设 isEnabled=true 或 undefined 时都算启用，只有明确为 false 才算禁用
        if (!qrApi.settings || qrApi.settings.isEnabled === false) {
            console.log(`[${Constants.EXTENSION_NAME}] Core Quick Reply v2 is disabled. Skipping standard reply fetch.`);
        } else {
            console.log(`[${Constants.EXTENSION_NAME}] Fetching standard Quick Replies...`);
            try {
                // Fetch Chat Quick Replies (Accessing internal settings)
                if (qrApi.settings?.chatConfig?.setList) {
                    qrApi.settings.chatConfig.setList.forEach(setLink => {
                        if (setLink?.isVisible && setLink.set?.qrList) {
                            setLink.set.qrList.forEach(qr => {
                                if (qr && !qr.isHidden && qr.label) { // Added check for qr object and label
                                    chatReplies.push({
                                        setName: setLink.set.name || 'Unknown Set',
                                        label: qr.label,
                                        message: qr.message || '(无消息内容)',
                                        isStandard: true // 标记为标准 Quick Reply
                                    });
                                    chatQrLabels.add(qr.label); // Add label to set for deduplication
                                }
                            });
                        }
                    });
                } else {
                     console.warn(`[${Constants.EXTENSION_NAME}] Could not find chatConfig.setList in quickReplyApi settings.`);
                }

                // Fetch Global Quick Replies (Accessing internal settings)
                if (qrApi.settings?.config?.setList) {
                    qrApi.settings.config.setList.forEach(setLink => {
                        if (setLink?.isVisible && setLink.set?.qrList) {
                            setLink.set.qrList.forEach(qr => {
                                // Only add to global if not hidden and label doesn't exist in chat replies
                                if (qr && !qr.isHidden && qr.label && !chatQrLabels.has(qr.label)) {
                                    globalReplies.push({
                                        setName: setLink.set.name || 'Unknown Set',
                                        label: qr.label,
                                        message: qr.message || '(无消息内容)',
                                        isStandard: true // 标记为标准 Quick Reply
                                    });
                                    // No need to add to chatQrLabels here, it's for chat/global deduplication
                                }
                            });
                        }
                    });
                } else {
                     console.warn(`[${Constants.EXTENSION_NAME}] Could not find config.setList in quickReplyApi settings.`);
                }
                console.log(`[${Constants.EXTENSION_NAME}] Fetched Standard Replies - Chat: ${chatReplies.length}, Global: ${globalReplies.length}`);

            } catch (error) {
                console.error(`[${Constants.EXTENSION_NAME}] Error fetching standard quick replies:`, error);
                // 不清空数组，允许继续扫描 JS Runner
            }
        }
    }

    // ***************************************************************
    // --- 修改：扫描 JS Runner 按钮 (增强功能) ---
    // 使用原生的 document.querySelectorAll 来查找按钮，避免可能的 jQuery 兼容性问题
    // ***************************************************************
    console.log(`[${Constants.EXTENSION_NAME} Debug] Starting JS Runner button scan using native querySelectorAll...`);
    try {
        // 使用一个更直接的原生选择器来查找所有符合条件的按钮
        // 根据截图结构：#qr--bar > .qr--buttons.th-button > .qr--button.menu_button.interactable
        // 注意：这里使用了 > 组合器，表示直接子元素。如果结构可能变化，可以去掉 >
        // 更安全的做法是查找所有容器，再在容器内查找按钮，但为了简洁和效率，先尝试直接查找
        const jsRunnerButtons = document.querySelectorAll('#qr--bar .qr--buttons.th-button .qr--button.menu_button.interactable');

        if (jsRunnerButtons.length > 0) {
            console.log(`[${Constants.EXTENSION_NAME} Debug] Found ${jsRunnerButtons.length} potential JS Runner buttons using native querySelectorAll.`);

            const scannedJsLabels = new Set(); // 用于防止重复添加 JS Runner 按钮

            jsRunnerButtons.forEach(buttonDiv => { // 使用原生的 forEach 遍历 NodeList
                const label = buttonDiv.textContent?.trim(); // 获取按钮上显示的文本作为 label
                // 检查标签是否有效，并且尚未被标准QR或已扫描的JS按钮使用
                if (label && label !== '' && !chatQrLabels.has(label) && !scannedJsLabels.has(label)) {
                    console.log(`[${Constants.EXTENSION_NAME} Debug] Adding JS Runner button: Label='${label}'`);
                    chatReplies.push({
                        setName: 'JS脚本按钮',         // 自定义分类名
                        label: label,                 // 按钮显示的文字
                        message: `[JS Runner] ${label}`, // 内部标识符或提示文本
                        isStandard: false             // 核心标记：表明不是标准QR
                    });
                    scannedJsLabels.add(label); // 记录已添加的JS按钮标签
                    chatQrLabels.add(label);    // 也添加到总的标签集合，以防全局QR中添加同名项
                } else if (label && (chatQrLabels.has(label) || scannedJsLabels.has(label))) {
                     // 如果标签重复了，记录一下日志
                     console.log(`[${Constants.EXTENSION_NAME} Debug] Skipping duplicate JS Runner button (label already exists): Label='${label}'`);
                } else if (!label || label === '') {
                    // 如果按钮没有有效标签，也记录一下
                     console.log(`[${Constants.EXTENSION_NAME} Debug] Skipping JS Runner button with empty label.`);
                }
            });
             console.log(`[${Constants.EXTENSION_NAME} Debug] Finished scanning JS Runner buttons. Added ${scannedJsLabels.size} unique buttons.`);
        } else {
            console.log(`[${Constants.EXTENSION_NAME} Debug] No JS Runner buttons found using native querySelectorAll('#qr--bar .qr--buttons.th-button .qr--button.menu_button.interactable').`);
        }
    } catch (error) {
        console.error(`[${Constants.EXTENSION_NAME}] Error during JS Runner button scanning:`, error);
    }
    // --- JS Runner 扫描结束 ---

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
        // setMenuVisible(false); // 让调用者处理 UI 状态
        return; // Indicate failure or inability to proceed
    }

    // --- 新增检查 ---
    // 触发前也检查主 Quick Reply v2 是否启用
    if (!window.quickReplyApi.settings || window.quickReplyApi.settings.isEnabled === false) {
         console.log(`[${Constants.EXTENSION_NAME}] Core Quick Reply v2 is disabled. Cannot trigger standard reply.`);
         // setMenuVisible(false); // 让调用者处理 UI 状态
         return;
    }
    // --- 检查结束 ---

    console.log(`[${Constants.EXTENSION_NAME}] Triggering Standard Quick Reply: "${setName}.${label}"`);
    try {
        // 假设 qrApi.executeQuickReply 是正确的 API 调用方法
        // 注意：根据 QuickReplyApi.js.txt，实际方法是 executeQuickReply
        await window.quickReplyApi.executeQuickReply(setName, label);
        console.log(`[${Constants.EXTENSION_NAME}] Standard Quick Reply "${setName}.${label}" executed successfully.`);
    } catch (error) {
        console.error(`[${Constants.EXTENSION_NAME}] Failed to execute Standard Quick Reply "${setName}.${label}":`, error);
        // 让调用者处理 UI 关闭，即使出错
    }
    // 不需要在这里设置 setMenuVisible(false)
}
