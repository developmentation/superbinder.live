// composables/usePrompts.js
import { useRealTime } from "./useRealTime.js";

const prompts = Vue.ref([]);
const { emit, on, off, userUuid } = useRealTime();

const processedEvents = new Set();
const eventHandlers = new WeakMap();

export function usePrompts() {
  function handleAddPrompt(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-prompt-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!prompts.value.some((p) => p.id === id)) {
        prompts.value.push({ id, userUuid: eventUserUuid, data });
        prompts.value = [...prompts.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleUpdatePrompt(eventObj) {
    const { id, data, timestamp } = eventObj;
    if (!id || !data || typeof data.name !== "string" || data.name.trim() === "") {
      console.warn("Invalid update-prompt data:", eventObj);
      return;
    }
    const prompt = prompts.value.find((p) => p.id === id);
    if (prompt) {
      prompt.data = { ...prompt.data, ...data }; // Preserve existing properties
      prompts.value = [...prompts.value];
    }
  }

  function handleRemovePrompt(eventObj) {
    const { id, timestamp } = eventObj;
    if (!id) {
      console.warn("Invalid remove-prompt data:", eventObj);
      return;
    }
    prompts.value = prompts.value.filter((p) => p.id !== id);
    prompts.value = [...prompts.value];
  }

  const addPromptHandler = on("add-prompt", handleAddPrompt);
  const updatePromptHandler = on("update-prompt", handleUpdatePrompt);
  const removePromptHandler = on("remove-prompt", handleRemovePrompt);

  eventHandlers.set(usePrompts, {
    add: addPromptHandler,
    update: updatePromptHandler,
    remove: removePromptHandler,
  });

  function addPrompt(name, description = "", text) {
    const id = uuidv4();
    const payload = {
      id,
      userUuid: userUuid.value,
      data: { name: name.trim(), description: description.trim(), text: text.trim() },
      timestamp: Date.now(),
    };
    prompts.value.push(payload);
    prompts.value = [...prompts.value];
    emit("add-prompt", payload);
    console.log("prompts.value", prompts.value)
  }

  function updatePrompt(id, name, description, text) {
    const prompt = prompts.value.find((p) => p.id === id);
    if (prompt) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { name: name.trim(), description: description.trim(), text: text.trim() },
        timestamp: Date.now(),
      };
      prompt.data = payload.data;
      prompts.value = [...prompts.value];
      emit("update-prompt", payload);
    }
  }

  function removePrompt(id) {
    const prompt = prompts.value.find((p) => p.id === id);
    if (prompt) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: null,
        timestamp: Date.now(),
      };
      prompts.value = prompts.value.filter((p) => p.id !== id);
      prompts.value = [...prompts.value];
      emit("remove-prompt", payload);
    }
  }

  function cleanup() {
    const handlers = eventHandlers.get(usePrompts);
    if (handlers) {
      off("add-prompt", handlers.add);
      off("update-prompt", handlers.update);
      off("remove-prompt", handlers.remove);
      eventHandlers.delete(usePrompts);
    }
    processedEvents.clear();
  }

  return {
    prompts,
    addPrompt,
    updatePrompt,
    removePrompt,
    cleanup,
  };
}