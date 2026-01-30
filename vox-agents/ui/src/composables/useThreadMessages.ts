/**
 * Composable for managing thread messages
 * Handles message operations and streaming logic for chat threads
 */

import type { Ref } from 'vue';
import type { EnvoyThread, ChatMessageRequest } from '@/utils/types';
import type { LanguageModelV2TextPart, LanguageModelV2ReasoningPart, LanguageModelV2ToolCallPart, LanguageModelV2ToolResultPart } from '@ai-sdk/provider';
import { api } from '@/api/client';
import type { ModelMessage } from 'ai';

export interface UseThreadMessagesOptions {
  thread: Ref<EnvoyThread | null>;
  sessionId: Ref<string>;
  isStreaming: Ref<boolean>;
  onNewChunk?: () => void;
}

export function useThreadMessages(options: UseThreadMessagesOptions) {
  const { thread, sessionId, isStreaming, onNewChunk } = options;
  let contents: Array<LanguageModelV2TextPart | LanguageModelV2ReasoningPart | LanguageModelV2ToolCallPart | LanguageModelV2ToolResultPart>;

  /**
   * Push or update an error message
   * @param error - Error object or string
   * @param messageIndex - Optional index to update existing message
   * @returns Index of the error message
   */
  const pushErrorMessage = (error: any) => {
    if (!thread.value) return -1;
    const errorMessage = typeof error === 'string'
      ? error
      : error?.message || 'An error occurred during the streaming.';
    const errorContent = `❌ ${errorMessage}`;
    // Update existing message
    contents.push({
      type: "text",
      text: errorContent
    });
  };

  /**
   * Send a message and handle streaming response
   * @param message - The message to send
   * @returns Cleanup function for SSE or undefined
   */
  const sendMessage = async (message: string): Promise<(() => void) | undefined> => {
    if (!message.trim() || isStreaming.value || !thread.value) {
      return;
    }

    // Add user message to thread with metadata
    const currentTurn = thread.value.metadata?.turn || 0;
    const userMessage: ModelMessage = { role: "user", content: message };
    thread.value.messages.push({
      message: userMessage,
      metadata: {
        datetime: new Date(),
        turn: currentTurn
      }
    });

    // Start streaming
    isStreaming.value = true;

    // Prepare for assistant response with array content for multi-part support
    const assistantMessage: ModelMessage = { role: "assistant", content: [] };
    thread.value.messages.push({
      message: assistantMessage,
      metadata: {
        datetime: new Date(),
        turn: currentTurn
      }
    });
    contents = thread.value.messages[thread.value.messages.length - 1]!.message.content as any;

    // Prepare for each type
    let currentText: LanguageModelV2TextPart | null = null;
    let currentTextID: string = "";
    let currentReasoning: LanguageModelV2ReasoningPart | null = null;
    let currentReasoningID: string = "";
    let currentToolCall: LanguageModelV2ToolCallPart | null = null;
    let currentToolCallID: string = "";
    let currentToolInput: string = "";

    try {
      const request: ChatMessageRequest = {
        chatId: sessionId.value,
        message: message
      };

      return api.streamAgentMessage(
        request,
        (part) => {
          switch (part.type) {
            case "text-delta":
              // Handle text streaming
              if (part.id !== currentTextID) {
                // New text part, create and add to contents
                currentTextID = part.id;
                currentText = { type: "text", text: part.text };
                contents.push(currentText);
                currentText = contents[contents.length - 1] as any;
              } else if (currentText) {
                // Continue streaming to existing text part
                currentText.text += part.text;
              }
              // Trigger event on meaningful text chunk
              onNewChunk?.();
              break;

            case "reasoning-delta":
              // Handle reasoning streaming (for models that support it)
              if (part.id !== currentReasoningID) {
                // New reasoning part, create and add to contents
                currentReasoningID = part.id;
                currentReasoning = { type: "reasoning", text: part.text };
                contents.push(currentReasoning);
                currentReasoning = contents[contents.length - 1] as any;
              } else if (currentReasoning) {
                // Continue streaming to existing reasoning part
                currentReasoning.text += part.text;
              }
              // Trigger event on reasoning chunk
              onNewChunk?.();
              break;

            case "tool-call":
              // Handle tool call streaming
              if (part.toolCallId !== currentToolCallID) {
                // New tool call, create and add to contents
                currentToolCallID = part.toolCallId;
                currentToolCall = {
                  type: "tool-call",
                  toolCallId: part.toolCallId,
                  toolName: part.toolName,
                  input: {}
                };
                contents.push(currentToolCall);
                currentToolCall = contents[contents.length - 1] as any;
              }
              break;

            case "tool-input-delta":
              // Handle tool input streaming (arguments)
              if (currentToolCall && part.id === currentToolCallID) {
                currentToolInput += part.delta;
                // Parse and merge the delta into args
                try {
                  currentToolCall.input = JSON.parse(part.delta);
                } catch (e) { }
              }
              break;

            case "tool-result":
              // Handle tool result
              contents.push({
                type: "tool-result",
                toolCallId: part.toolCallId,
                toolName: part.toolName,
                output: part.output
              });
              // Trigger event on tool result
              onNewChunk?.();
              break;

            default:
              // Log unknown part types for debugging
              console.warn('Unknown stream part type:', part.type, part);
              break;
          }
        },
        (error) => {
          console.error('SSE error:', error);
          pushErrorMessage(error);
          isStreaming.value = false;
        },
        () => {
          // onDone callback - streaming completed successfully
          console.log('Streaming completed');
          isStreaming.value = false;
        }
      );
    } catch (error) {
      console.error('Failed to send message:', error);
      pushErrorMessage(error instanceof Error ? error : 'Failed to send message');
      isStreaming.value = false;
    }
  };

  return { sendMessage };
}