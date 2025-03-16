// components/LazyScrollViewer.js
export default {
  name: 'LazyScrollViewer',
  props: {
    pages: {
      type: Array,
      default: () => [],
    },
    buffer: {
      type: Number,
      default: 1,
    },
    headerOffset: { // New prop for sticky header height
      type: Number,
      default: 0,
    },
  },
  emits: ['scroll', 'contextmenu', 'page-visible'],
  setup(props, { emit }) {
    const scrollContainer = Vue.ref(null);
    const pageRefs = Vue.ref([]);
    const scrollTop = Vue.ref(0);
    const visibleRange = Vue.ref({ start: 0, end: 0 });
    const firstPageHeight = Vue.ref(null);

    const allPages = Vue.reactive(
      props.pages.map((html, index) => ({
        index,
        html: html || '',
        isLoaded: false,
      }))
    );

    const setFirstPageHeight = () => {
      if (!firstPageHeight.value && pageRefs.value[0]) {
        firstPageHeight.value = pageRefs.value[0].offsetHeight;
        console.log(`First page height set to: ${firstPageHeight.value}px`);
      }
    };

    const updateVisibleRange = () => {
      if (!scrollContainer.value || allPages.length === 0) return;

      const containerHeight = scrollContainer.value.clientHeight;
      const scrollPosition = scrollTop.value;
      const pageHeight = firstPageHeight.value || 1170;

      const startIndex = Math.max(
        0,
        Math.floor(scrollPosition / pageHeight) - props.buffer
      );
      const endIndex = Math.min(
        allPages.length - 1,
        Math.ceil((scrollPosition + containerHeight) / pageHeight) + props.buffer
      );

      for (let i = startIndex; i <= endIndex; i++) {
        if (!allPages[i].isLoaded) {
          allPages[i].isLoaded = true;
          console.log(`Loaded page ${i + 1} of ${allPages.length}`);
        }
      }

      visibleRange.value = { start: startIndex, end: endIndex };

      const centerIndex = Math.floor(
        (scrollPosition + containerHeight / 2) / pageHeight
      );
      if (centerIndex >= 0 && centerIndex < allPages.length) {
        emit('page-visible', centerIndex);
      }
    };

    const handleScroll = (newScrollTop) => {
      scrollTop.value = newScrollTop;
      updateVisibleRange();
      emit('scroll', scrollTop.value);
    };

    const scrollToPage = (pageIndex) => {
      if (
        !scrollContainer.value ||
        pageIndex < 0 ||
        pageIndex >= allPages.length
      ) {
        console.error(
          `Invalid scroll: pageIndex=${pageIndex}, pages=${allPages.length}`
        );
        return;
      }

      const ensureTargetLoaded = () => {
        if (!allPages[pageIndex].isLoaded) {
          allPages[pageIndex].isLoaded = true;
          Vue.nextTick(() => scrollToTarget());
        } else {
          scrollToTarget();
        }
      };

      const scrollToTarget = () => {
        const targetEl = pageRefs.value[pageIndex];
        if (targetEl && scrollContainer.value) {
          const pageHeight = targetEl.offsetHeight;
          const targetPosition = pageIndex * pageHeight - props.headerOffset;
          console.log(
            `Scrolling to page ${pageIndex + 1}, position: ${targetPosition}px (adjusted for header offset: ${props.headerOffset}px)`
          );
          scrollContainer.value.scrollTo({
            top: targetPosition,
            behavior: 'smooth',
          });
          scrollTop.value = targetPosition;
          Vue.nextTick(updateVisibleRange);
        } else {
          console.error(`Page ${pageIndex + 1} ref not found, aborting scroll`);
        }
      };

      if (pageIndex < visibleRange.value.start || pageIndex > visibleRange.value.end) {
        visibleRange.value = {
          start: Math.max(0, pageIndex - props.buffer),
          end: Math.min(allPages.length - 1, pageIndex + props.buffer),
        };
        ensureTargetLoaded();
      } else {
        ensureTargetLoaded();
      }
    };

    Vue.onMounted(() => {
      Vue.nextTick(() => {
        if (allPages.length > 0) {
          allPages[0].isLoaded = true;
          Vue.nextTick(() => {
            setFirstPageHeight();
            updateVisibleRange();
          });
        }
        if (scrollContainer.value) {
          scrollContainer.value.addEventListener('scroll', () => {
            handleScroll(scrollContainer.value.scrollTop);
          });
        }
      });
    });

    Vue.onUnmounted(() => {
      if (scrollContainer.value) {
        scrollContainer.value.removeEventListener('scroll', handleScroll);
      }
    });

    Vue.watch(
      () => props.pages,
      (newPages) => {
        allPages.length = 0;
        if (newPages && newPages.length > 0) {
          newPages.forEach((html, index) => {
            allPages.push({
              index,
              html: html || '',
              isLoaded: index === 0,
            });
          });
          Vue.nextTick(() => {
            setFirstPageHeight();
            updateVisibleRange();
          });
        }
      },
      { immediate: true }
    );

    const setPageRef = (el, index) => {
      if (el) pageRefs.value[index] = el;
    };

    return {
      scrollContainer,
      allPages,
      firstPageHeight,
      scrollToPage,
      handleScroll,
      setPageRef,
    };
  },
  template: `
    <div class="lazy-scroll-viewer pdf-viewer" ref="scrollContainer" style="height: 100%;">
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