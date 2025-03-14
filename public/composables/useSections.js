// ./composables/useSections.js
import { useRealTime } from "./useRealTime.js";

const sections = Vue.ref([]);
const { emit, on, off, userUuid } = useRealTime();

const processedEvents = new Set();
const eventHandlers = new WeakMap();

export function useSections() {
  function handleAddSection(eventObj) {
    const { id, userUuid: eventUserUuid, data, timestamp } = eventObj;
    const eventKey = `add-section-${id}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      if (!sections.value.some((s) => s.id === id)) {
        sections.value.push({ id, userUuid: eventUserUuid, data });
        sections.value = [...sections.value];
      }
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  function handleUpdateSection(eventObj) {
    const { id, data, timestamp } = eventObj;
    if (!id || !data || typeof data.name !== "string" || data.name.trim() === "") {
      console.warn("Invalid update-section data:", eventObj);
      return;
    }
    const section = sections.value.find((s) => s.id === id);
    if (section) {
      section.data = { ...section.data, ...data }; // Preserve existing properties
      sections.value = [...sections.value];
    }
  }

  function handleRemoveSection(eventObj) {
    const { id, timestamp } = eventObj;
    if (!id) {
      console.warn("Invalid remove-section data:", eventObj);
      return;
    }
    sections.value = sections.value.filter((s) => s.id !== id);
    sections.value = [...sections.value];
  }

  function handleReorderSections(eventObj) {
    const { data, timestamp } = eventObj;
    const { sectionId, order } = data; // sectionId can be null for root
    if (!Array.isArray(order) || order.length === 0) {
      console.error("Invalid reorder-sections data:", eventObj);
      return;
    }
    const eventKey = `reorder-sections-${sectionId || "root"}-${order.join("-")}-${timestamp}`;
    if (!processedEvents.has(eventKey)) {
      processedEvents.add(eventKey);
      const siblings = sections.value.filter(
        (s) => (s.data.sectionId || null) === (sectionId || null)
      );
      const reordered = order
        .map((id, index) => {
          const section = sections.value.find((s) => s.id === id);
          if (section && (section.data.sectionId || null) === (sectionId || null)) {
            section.data.order = index;
            return section;
          }
          return null;
        })
        .filter(Boolean);
      siblings.forEach((s) => {
        if (!reordered.some((r) => r.id === s.id)) {
          reordered.push(s); // Preserve sections not in new order
        }
      });
      sections.value = [
        ...sections.value.filter((s) => (s.data.sectionId || null) !== (sectionId || null)),
        ...reordered,
      ];
      sections.value = [...sections.value];
      setTimeout(() => processedEvents.delete(eventKey), 1000);
    }
  }

  const addSectionHandler = on("add-section", handleAddSection);
  const updateSectionHandler = on("update-section", handleUpdateSection);
  const removeSectionHandler = on("remove-section", handleRemoveSection);
  const reorderSectionsHandler = on("reorder-sections", handleReorderSections);

  eventHandlers.set(useSections, {
    add: addSectionHandler,
    update: updateSectionHandler,
    remove: removeSectionHandler,
    reorder: reorderSectionsHandler,
  });

  function addSection(name, sectionId = null) {
    const id = uuidv4();
    const siblings = sections.value.filter(
      (s) => (s.data.sectionId || null) === (sectionId || null)
    );
    const order = siblings.length;
    const payload = {
      id,
      userUuid: userUuid.value,
      data: { name: name.trim(), sectionId, order },
      timestamp: Date.now(),
    };
    sections.value.push(payload);
    sections.value = [...sections.value];
    emit("add-section", payload);
  }

  function updateSection(id, name) {
    const section = sections.value.find((s) => s.id === id);
    if (section) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: { ...section.data, name: name.trim() },
        timestamp: Date.now(),
      };
      section.data.name = name.trim();
      sections.value = [...sections.value];
      emit("update-section", payload);
    }
  }

  function removeSection(id) {
    const section = sections.value.find((s) => s.id === id);
    if (section) {
      const payload = {
        id,
        userUuid: userUuid.value,
        data: null,
        timestamp: Date.now(),
      };
      sections.value = sections.value.filter((s) => s.id !== id);
      sections.value = [...sections.value];
      emit("remove-section", payload);
    }
  }

  function reorderSections(sectionId, draggedId, newIndex) {
    const siblings = sections.value
      .filter((s) => (s.data.sectionId || null) === (sectionId || null))
      .sort((a, b) => a.data.order - b.data.order);
    const currentIndex = siblings.findIndex((s) => s.id === draggedId);
    if (currentIndex === -1) return;

    const newOrder = [...siblings];
    const [movedSection] = newOrder.splice(currentIndex, 1);
    newOrder.splice(newIndex, 0, movedSection);
    newOrder.forEach((s, index) => (s.data.order = index));

    const payload = {
      id: draggedId,
      userUuid: userUuid.value,
      data: { sectionId, order: newOrder.map((s) => s.id) },
      timestamp: Date.now(),
    };
    sections.value = [
      ...sections.value.filter((s) => (s.data.sectionId || null) !== (sectionId || null)),
      ...newOrder,
    ];
    emit("reorder-sections", payload);
  }

  function cleanup() {
    const handlers = eventHandlers.get(useSections);
    if (handlers) {
      off("add-section", handlers.add);
      off("update-section", handlers.update);
      off("remove-section", handlers.remove);
      off("reorder-sections", handlers.reorder);
      eventHandlers.delete(useSections);
    }
    processedEvents.clear();
  }

  return {
    sections,
    addSection,
    updateSection,
    removeSection,
    reorderSections,
    cleanup,
  };
}