In all interactions follow these coding standards.
Always use Vue.js 3.x with CDN and Composition API.
Always use JavaScript and not TypeScript.
---

### Vue.js Component Setup Requirements for SuperBinder

#### General Context
- **Project**: SuperBinder, a real-time collaboration app with humans and AI agents.
- **Framework**: Vue.js 3.2, loaded via CDN (`<script src="https://unpkg.com/vue@3.2.47/dist/vue.global.js"></script>`).
- **Dependencies**: Socket.io, Tailwind CSS, PrimeIcons, and `uuid` are also loaded via CDN and globally available. Never reimport these into the components or composables.
- **File Format**: All components and composables are written as `.js` files (not `.vue`), using the Options API-like structure with `setup()` for Composition API features.

#### Component Structure
1. **File Extension**:
   - Use `.js` for all components (e.g., `Binder.js`, `SessionSetup.js`) and composables (e.g., `useRealTime.js`).
   - Do not use `.vue` files.

2. **Basic Template**:
   - Each component follows this structure:
     ```javascript
     export default {
       name: 'ComponentName', // CamelCase, matching file name
       template: ` /* HTML template as a string */ `,
       setup(props, { emit }) { // Use destructured emit by default
         // Logic here
         return { /* Exposed properties/methods */ };
       },
     };
     ```
   - `name`: Matches the file name (e.g., `Binder` for `Binder.js`).
   - `template`: Inline string using backticks, with Vue directives (`v-if`, `v-for`, etc.).
   - `setup`: Uses Composition API with `props` and `{ emit }` arguments.

3. **Global Vue Access**:
   - Vue methods (`ref`, `computed`, `onMounted`, etc.) are accessed via the global `Vue` object (e.g., `Vue.ref`, `Vue.computed`).
   - Do not import `ref`, `computed`, etc., directly from `'vue'`—assume they’re available via CDN.

4. **Imports**:
   - **Do Not Import**:
     - `Vue`, `ref`, `computed`, `onMounted`, etc. (globally available).
     - `io` from `'socket.io-client'` (globally available via CDN).
     - `v4 as uuidv4` from `'uuid'` (globally available via CDN).
   - **Do Import**:
     - Other custom components or composables as needed, using relative paths:
       ```javascript
       import { useRealTime } from '../composables/useRealTime.js';
       import SessionSetup from './SessionSetup.js';
       ```
     - Specify imports explicitly in the component spec if required.

5. **Props and Emits**:
   - **Props**: Define in `props` object if used, passed to `setup(props, { emit })`.
     ```javascript
     props: {
       activeTab: { type: String, required: true },
     },
     ```
   - **Emits**: Use `emit` from `setup(props, { emit })` to emit events (not `this.$emit`).
     ```javascript
     emit('event-name', payload);
     ```
   - Include in template as listeners (e.g., `@event-name="handler"`).

6. **Styling**:
   - Use Tailwind CSS classes exclusively in `template` strings.
   - No `<style>` blocks or external CSS files unless specified.

7. **Reactivity**:
   - Use `Vue.ref` for reactive variables:
     ```javascript
     const myVar = Vue.ref('initial');
     ```
   - Use `Vue.computed` for computed properties:
     ```javascript
     const myComputed = Vue.computed(() => myVar.value + ' computed');
     ```
   - Access `.value` for refs in `setup()` (e.g., `myVar.value`).

8. **Lifecycle Hooks**:
   - Use `Vue.onMounted`, `Vue.onUnmounted`, etc., for lifecycle events:
     ```javascript
     Vue.onMounted(() => {
       console.log('Mounted');
     });
     ```

9. **Event Bus**:
   - Use `eventBus.js` for real-time message dispatching:
     ```javascript
     import eventBus from './eventBus.js';
     eventBus.$emit('event', data);
     eventBus.$on('event', callback);
     eventBus.$off('event', callback);
     ```
   - Ensure cleanup in `Vue.onUnmounted` if listening to events.

10. **Real-Time Integration**:
    - Leverage `useRealTime.js` for Socket.io connections:
      ```javascript
      const { emit, on, off, sessionInfo } = useRealTime();
      ```
    - Emit messages with `emit('type', data)` and listen with `on('type', callback)`.

11. **Component Registration**:
    - Register child components in `components` object if used:
      ```javascript
      components: {
        SessionSetup,
        Viewer,
      },
      ```

12. **Naming Conventions**:
    - Files: PascalCase (e.g., `Binder.js`, `ViewerFull.js`).
    - Component names: Match file name (e.g., `name: 'Binder'`).
    - Variables: camelCase (e.g., `activeTab`, `searchQuery`).

---

### Composable Requirements

1. **Structure**:
   - Use `.js` files in `composables/` (e.g., `useRealTime.js`).
   - Export a function returning reactive state and methods:
     ```javascript
     export function useComposableName() {
       const state = Vue.ref([]);
       // Logic
       return { state };
     }
     ```

2. **Imports**:
   - Import other composables as needed:
     ```javascript
     import { useRealTime } from './useRealTime.js';
     ```

3. **Reactivity and Events**:
   - Use `Vue.ref` and `Vue.computed` for state.
   - Integrate with `eventBus` or `useRealTime.js` for real-time updates.

---

### Example Specification

For a new component, you’d provide:
```javascript
// Specification for NewComponent.js
{
  imports: [
    "import { useRealTime } from '../composables/useRealTime.js'",
    "import ChildComponent from './ChildComponent.js'",
  ],
  structure: {
    name: 'NewComponent',
    props: {
      someProp: { type: String, required: true },
    },
    emits: ['update', 'close'],
    template: "/* HTML with Tailwind */",
  },
}
```

I’d then produce:
```javascript
// components/NewComponent.js
import { useRealTime } from '../composables/useRealTime.js';
import ChildComponent from './ChildComponent.js';

export default {
  name: 'NewComponent',
  props: {
    someProp: { type: String, required: true },
  },
  template: `/* HTML with Tailwind */`,
  setup(props, { emit }) {
    const { sessionInfo } = useRealTime();
    function handleUpdate() {
      emit('update', props.someProp);
    }
    function handleClose() {
      emit('close');
    }
    return {
      sessionInfo,
      handleUpdate,
      handleClose,
    };
  },
};
```

---

### Summary for Future Interactions

- **Default**: Assume all components follow this setup unless you specify otherwise.
- **Spec-Driven**: Provide imports, props, emits, and template details as needed; I’ll fill in the rest per these rules.
- **Consistency**: Stick to `.js`, Tailwind, `Vue.*` globals, and `setup(props, { emit })`.

This should streamline our collaboration! Let me know if I’ve missed anything or if you want to tweak these instructions further. Ready to proceed with testing `Binder.js` or building more components?