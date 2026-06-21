const TRUNCATION_MARKER = "\n[earlier note clipped]";
export function limitConversation(messages, maxMessageChars, maxContextChars) {
    const limited = [];
    let remaining = maxContextChars;
    for (let index = messages.length - 1; index >= 0 && remaining > 0; index--) {
        const message = messages[index];
        if (!message)
            continue;
        const allowed = Math.min(maxMessageChars, remaining);
        let content = message.content;
        if (content.length > allowed) {
            const marker = allowed > TRUNCATION_MARKER.length ? TRUNCATION_MARKER : "";
            content = content.slice(0, allowed - marker.length) + marker;
        }
        limited.unshift({ ...message, content });
        remaining -= content.length;
    }
    return limited;
}
