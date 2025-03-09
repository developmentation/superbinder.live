// components/LazyScrollViewer.js
export default {
    name: 'LazyScrollViewer',
    props: {
      pages: {
        type: Array, // Array of HTML strings
        default: () => [],
      },
      buffer: {
        type: Number,
        default: 1, // Pages to pre-load above/below viewport
      },
    },
    emits: ['scroll', 'contextmenu', 'page-visible'],
    setup(props, { emit }) {
      const scrollContainer = Vue.ref(null);
      const pageRefs = Vue.ref([]); // Refs for all pages (placeholders or content)
      const scrollTop = Vue.ref(0);
      const visibleRange = Vue.ref({ start: 0, end: 0 });
      const firstPageHeight = Vue.ref(null); // Height of the first page
  
      // All pages with initial placeholder state
      const allPages = Vue.reactive(props.pages.map((html, index) => ({
        index,
        html: html || '',
        isLoaded: false, // Tracks if content is loaded
      })));
  
      // Set the height of the first page once rendered
      const setFirstPageHeight = () => {
        if (!firstPageHeight.value && pageRefs.value[0]) {
          firstPageHeight.value = pageRefs.value[0].offsetHeight;
          console.log(`First page height set to: ${firstPageHeight.value}px`);
        }
      };
  
      // Update visible range and load content
      const updateVisibleRange = () => {
        if (!scrollContainer.value) return;
  
        const containerHeight = scrollContainer.value.clientHeight;
        const scrollPosition = scrollContainer.value.scrollTop;
        const pageHeight = firstPageHeight.value || 1170; // Dynamic fallback
  
        const startIndex = Math.max(
          0,
          Math.floor(scrollPosition / pageHeight) - props.buffer
        );
        const endIndex = Math.min(
          props.pages.length - 1,
          Math.ceil((scrollPosition + containerHeight) / pageHeight) + props.buffer
        );
  
        // Load content for visible range
        for (let i = startIndex; i <= endIndex; i++) {
          allPages[i].isLoaded = true;
        }
  
        visibleRange.value = { start: startIndex, end: endIndex };
  
        // Emit currently centered page
        const centerIndex = Math.floor((scrollPosition + containerHeight / 2) / pageHeight);
        if (centerIndex >= 0 && centerIndex < props.pages.length) {
          emit('page-visible', centerIndex);
        }
  
        // console.log(`Visible range updated: ${startIndex} to ${endIndex}, firstPageHeight: ${firstPageHeight.value || 'not set'}`);
      };
  
      // Handle scroll event
      const handleScroll = () => {
        if (!scrollContainer.value) return;
        scrollTop.value = scrollContainer.value.scrollTop;
        updateVisibleRange();
        emit('scroll', scrollTop.value);
      };
  
      // Scroll to a specific page, mimicking Jump to Page success
      const scrollToPage = (pageIndex) => {
        if (!scrollContainer.value || pageIndex < 0 || pageIndex >= props.pages.length) {
          console.error(`Invalid scroll: pageIndex=${pageIndex}, pages=${props.pages.length}`);
          return;
        }
  
        console.log(`Attempting to scroll to page index: ${pageIndex}, ref exists: ${!!pageRefs.value[pageIndex]}`);
  
        const ensureTargetLoaded = () => {
          if (!allPages[pageIndex].isLoaded) {
            // console.log(`Loading content for page ${pageIndex + 1} before scroll`);
            allPages[pageIndex].isLoaded = true;
            Vue.nextTick(() => scrollToTarget());
          } else {
            scrollToTarget();
          }
        };
  
        const scrollToTarget = () => {
          const targetEl = pageRefs.value[pageIndex];
          if (targetEl) {
            // console.log(`Scrolling to page ${pageIndex + 1} (index: ${pageIndex}), height: ${targetEl.offsetHeight}px`);
            targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
            scrollTop.value = scrollContainer.value.scrollTop;
            Vue.nextTick(updateVisibleRange);
          } else {
            console.error(`Page ${pageIndex + 1} ref not found, aborting scroll`);
          }
        };
  
        // Ensure the target is within the visible range or loaded
        if (pageIndex < visibleRange.value.start || pageIndex > visibleRange.value.end) {
          visibleRange.value = {
            start: Math.max(0, pageIndex - props.buffer),
            end: Math.min(props.pages.length - 1, pageIndex + props.buffer),
          };
          ensureTargetLoaded();
        } else {
          ensureTargetLoaded();
        }
      };
  
      // Lifecycle hooks
      Vue.onMounted(() => {
        Vue.nextTick(() => {
          allPages[0].isLoaded = true; // Load first page to get height
          Vue.nextTick(() => {
            setFirstPageHeight();
            updateVisibleRange();
            if (scrollContainer.value) {
              scrollContainer.value.addEventListener('scroll', handleScroll);
            }
          });
        });
      });
  
      Vue.onUnmounted(() => {
        if (scrollContainer.value) {
          scrollContainer.value.removeEventListener('scroll', handleScroll);
        }
      });
  
      Vue.watch(() => props.pages, (newPages) => {
        allPages.length = 0;
        newPages.forEach((html, index) => {
          allPages.push({ index, html: html || '', isLoaded: index === 0 });
        });
        Vue.nextTick(() => {
          setFirstPageHeight();
          updateVisibleRange();
        });
      });
  
      // Set ref for each page
      const setPageRef = (el, index) => {
        if (el) {
          pageRefs.value[index] = el;
        //   console.log(`Ref set for page ${index + 1}, height: ${el.offsetHeight}px`);
        }
      };
  
      return {
        scrollContainer,
        allPages,
        firstPageHeight,
        scrollToPage,
        setPageRef,
      };
    },
    template: `
      <div class="lazy-scroll-viewer pdf-viewer" ref="scrollContainer" style="overflow-y: auto; height: 100%;">
        <div class="inner-container" style="display: flex; flex-direction: column;">
          <div
            v-for="page in allPages"
            :key="page.index"
            class="page-wrapper"
            :data-page-index="page.index"
            :ref="el => setPageRef(el, page.index)"
            :style="{ height: firstPageHeight ? firstPageHeight + 'px' : 'auto' }"
          >
            <div
              v-if="page.isLoaded"
              v-html="page.html"
              class="pdf-page"
              style="margin: 0; padding: 0;"
              @contextmenu.prevent="$emit('contextmenu', $event, page.index)"
            />
            <div
              v-else
              class="page-placeholder"
              :style="{ height: firstPageHeight ? firstPageHeight + 'px' : '1170px', background: '#f0f0f0' }"
            ></div>
          </div>
        </div>
      </div>
    `,
  };