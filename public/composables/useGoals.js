// composables/useGoals.js
import { useRealTime } from "./useRealTime.js";

const goals = Vue.ref([]);
const { emit, on, off, userUuid } = useRealTime();

const processedEvents = new Set();
const eventHandlers = new WeakMap();

export function useGoals() {
  function handleAddGoal(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-goal-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!goals.value.some((g) => g.id === id)) {
        goals.value.push({ id, userUuid: eventUserUuid, data });
        goals.value = [...goals.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleUpdateGoal(eventObj) {
    const { id, data, timestamp } = eventObj;
    if (!id || !data || typeof data.text !== "string" || data.text.trim() === "") {
      console.warn("Invalid update-goal data:", eventObj);
      return;
    }
    const goal = goals.value.find((g) => g.id === id);
    if (goal) {
      goal.data = { ...goal.data, ...data }; // Preserve existing data properties
      goals.value = [...goals.value];
    }
  }

  function handleRemoveGoal(eventObj) {
    const { id, timestamp } = eventObj;
    if (!id) {
      console.warn("Invalid remove-goal data:", eventObj);
      return;
    }
    const goalIndex = goals.value.findIndex((g) => g.id === id);
    if (goalIndex !== -1) {
      goals.value.splice(goalIndex, 1);
      goals.value.forEach((goal, index) => {
        goal.data.order = index;
      });
      goals.value = [...goals.value];
    }
  }

  function handleReorderGoals(eventObj) {
    const { data, timestamp } = eventObj;
    const order = data.order;
    if (!Array.isArray(order) || order.length === 0) {
      console.error("Invalid reorder-goals data:", eventObj);
      return;
    }
    const eventKey = `reorder-goals-${order.join("-")}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      goals.value = order
        .map((id, index) => {
          const goal = goals.value.find((g) => g.id === id);
          if (!goal) return null;
          goal.data.order = index;
          return goal;
        })
        .filter(Boolean);
      goals.value = [...goals.value];
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  // Register event handlers (no init-state handling)
  const addGoalHandler = on("add-goal", handleAddGoal);
  const updateGoalHandler = on("update-goal", handleUpdateGoal);
  const removeGoalHandler = on("remove-goal", handleRemoveGoal);
  const reorderGoalsHandler = on("reorder-goals", handleReorderGoals);

  eventHandlers.set(useGoals, {
    add: addGoalHandler,
    update: updateGoalHandler,
    remove: removeGoalHandler,
    reorder: reorderGoalsHandler,
  });

  function addGoal(text) {
    const id = uuidv4();
    const order = goals.value.length;
    const payload = {
      id,
      userUuid: userUuid.value,
      data: { text: text.trim(), order },
      timestamp: Date.now(),
    };
    goals.value.push(payload);
    goals.value = [...goals.value];
    emit("add-goal", payload);
  }

  function updateGoal(id, text) {
    const goal = goals.value.find((g) => g.id === id);
    if (goal) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { text: text.trim(), order: goal.data.order },
        timestamp: Date.now(),
      };
      goal.data = payload.data;
      goals.value = [...goals.value];
      emit("update-goal", payload);
    }
  }

  function removeGoal(id) {
    const goalIndex = goals.value.findIndex((g) => g.id === id);
    if (goalIndex !== -1) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: null,
        timestamp: Date.now(),
      };
      goals.value.splice(goalIndex, 1);
      goals.value.forEach((goal, index) => {
        goal.data.order = index;
      });
      goals.value = [...goals.value];
      emit("remove-goal", payload);
    }
  }

  function reorderGoals(draggedId, newIndex) {
    const currentIndex = goals.value.findIndex((g) => g.id === draggedId);
    if (currentIndex === -1) return;

    const newOrder = [...goals.value];
    const [movedGoal] = newOrder.splice(currentIndex, 1);
    newOrder.splice(newIndex, 0, movedGoal);
    newOrder.forEach((goal, index) => {
      goal.data.order = index;
    });

    const payload = {
      id: draggedId,
      userUuid: userUuid.value,
      data: { order: newOrder.map((g) => g.id) },
      timestamp: Date.now(),
    };
    goals.value = newOrder;
    emit("reorder-goals", payload);
  }

  function cleanup() {
    const handlers = eventHandlers.get(useGoals);
    if (handlers) {
      off("add-goal", handlers.add);
      off("update-goal", handlers.update);
      off("remove-goal", handlers.remove);
      off("reorder-goals", handlers.reorder);
      eventHandlers.delete(useGoals);
    }
    processedEvents.clear();
  }

  return {
    goals,
    addGoal,
    updateGoal,
    removeGoal,
    reorderGoals,
    cleanup,
  };
}