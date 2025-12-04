<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { marked } from 'marked'

const releases = ref([])
const loading = ref(true)
const error = ref(null)
const activeRelease = ref(null)

const API_URL = import.meta.env.PROD
  ? 'https://app.getraze.co/api/public/releases'
  : 'http://localhost:3001/api/public/releases'

// Configure marked for safe rendering
marked.setOptions({
  breaks: true,
  gfm: true
})

onMounted(async () => {
  try {
    const response = await fetch(API_URL)
    const data = await response.json()
    if (data.success) {
      releases.value = data.data
      if (data.data.length > 0) {
        activeRelease.value = data.data[0].version
      }
    } else {
      error.value = 'Failed to load releases'
    }
  } catch (e) {
    error.value = 'Failed to connect to server'
    console.error('Error loading releases:', e)
  } finally {
    loading.value = false
  }

  // Setup scroll observer
  setupScrollObserver()
})

const setupScrollObserver = () => {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          activeRelease.value = entry.target.id.replace('release-', '')
        }
      })
    },
    { rootMargin: '-100px 0px -70% 0px' }
  )

  // Observe all release cards after they're rendered
  setTimeout(() => {
    document.querySelectorAll('.release-card').forEach((card) => {
      observer.observe(card)
    })
  }, 100)
}

const formatDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

const formatShortDate = (dateString) => {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}

const renderMarkdown = (content) => {
  if (!content) return ''
  return marked(content)
}

const scrollToRelease = (version) => {
  const element = document.getElementById(`release-${version}`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}
</script>

<template>
  <div class="changelog-wrapper">
    <!-- Main Content -->
    <div class="changelog-main">
      <!-- Loading State -->
      <div v-if="loading" class="loading">
        <div class="spinner"></div>
        <p>Loading releases...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error">
        <p>{{ error }}</p>
      </div>

      <!-- Releases List -->
      <div v-else-if="releases.length > 0" class="releases-list">
        <article
          v-for="release in releases"
          :key="release.id"
          :id="`release-${release.version}`"
          class="release-card"
        >
          <!-- Header -->
          <header class="release-header">
            <div class="release-meta">
              <span class="version-badge">{{ release.version }}</span>
              <time class="release-date">{{ formatDate(release.published_at) }}</time>
            </div>
            <h2 v-if="release.title" class="release-title">{{ release.title }}</h2>
          </header>

          <!-- Content - Rendered Markdown -->
          <div class="release-content vp-doc" v-html="renderMarkdown(release.content)"></div>
        </article>
      </div>

      <!-- Empty State -->
      <div v-else class="empty">
        <div class="empty-icon">📋</div>
        <p>No releases published yet.</p>
        <span class="empty-hint">Check back soon for updates!</span>
      </div>
    </div>

    <!-- Sidebar Navigation -->
    <aside v-if="!loading && !error && releases.length > 0" class="changelog-sidebar">
      <div class="sidebar-content">
        <h3 class="sidebar-title">Releases</h3>
        <nav class="releases-nav">
          <a
            v-for="release in releases"
            :key="release.id"
            :href="`#release-${release.version}`"
            :class="['nav-item', { active: activeRelease === release.version }]"
            @click.prevent="scrollToRelease(release.version)"
          >
            <span class="nav-version">{{ release.version }}</span>
            <span class="nav-date">{{ formatShortDate(release.published_at) }}</span>
          </a>
        </nav>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.changelog-wrapper {
  display: flex;
  gap: 2rem;
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
}

.changelog-main {
  flex: 1;
  min-width: 0;
}

.changelog-sidebar {
  width: 180px;
  flex-shrink: 0;
}

.sidebar-content {
  position: sticky;
  top: 100px;
}

.sidebar-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  margin: 0 0 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider-light);
}

.releases-nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s ease;
  border-left: 2px solid transparent;
  margin-left: -2px;
}

.nav-item:hover {
  background: var(--vp-c-bg-soft);
}

.nav-item.active {
  background: var(--vp-c-brand-soft);
  border-left-color: var(--vp-c-brand-1);
}

.nav-version {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
}

.nav-item.active .nav-version {
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.nav-date {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
}

/* Loading */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 0;
  color: var(--vp-c-text-2);
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.error {
  padding: 2rem;
  background: var(--vp-c-danger-soft);
  border-radius: 12px;
  color: var(--vp-c-danger-1);
  text-align: center;
}

/* Releases List */
.releases-list {
  display: flex;
  flex-direction: column;
  gap: 3rem;
  margin-top: 2rem;
}

/* Release Card */
.release-card {
  border-bottom: 1px solid var(--vp-c-divider);
  padding-bottom: 3rem;
  scroll-margin-top: 80px;
}

.release-card:last-child {
  border-bottom: none;
}

.release-header {
  margin-bottom: 1.5rem;
}

.release-meta {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.version-badge {
  display: inline-flex;
  align-items: center;
  padding: 0.35rem 1rem;
  background: var(--vp-c-brand-1);
  color: white;
  border-radius: 9999px;
  font-size: 0.875rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.release-date {
  color: var(--vp-c-text-3);
  font-size: 0.9rem;
}

.release-title {
  margin: 0.75rem 0 0;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1.3;
}

/* Release Content - Markdown Styles */
.release-content {
  padding: 0;
}

.release-content:deep(h1),
.release-content:deep(h2),
.release-content:deep(h3),
.release-content:deep(h4) {
  margin-top: 1.5rem;
  margin-bottom: 1rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.release-content:deep(h2) {
  font-size: 1.25rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider-light);
}

.release-content:deep(h3) {
  font-size: 1.1rem;
}

.release-content:deep(h2:first-child),
.release-content:deep(h3:first-child) {
  margin-top: 0;
}

.release-content:deep(p) {
  margin: 0.75rem 0;
  line-height: 1.7;
  color: var(--vp-c-text-2);
}

.release-content:deep(ul),
.release-content:deep(ol) {
  margin: 1rem 0;
  padding-left: 1.5rem;
}

.release-content:deep(li) {
  margin: 0.5rem 0;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

.release-content:deep(li::marker) {
  color: var(--vp-c-brand-1);
}

.release-content:deep(strong) {
  color: var(--vp-c-text-1);
  font-weight: 600;
}

.release-content:deep(code) {
  background: var(--vp-c-mute);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.875em;
  color: var(--vp-c-text-1);
}

.release-content:deep(pre) {
  background: var(--vp-c-bg-alt);
  padding: 1rem;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
}

.release-content:deep(pre code) {
  background: none;
  padding: 0;
}

.release-content:deep(a) {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.release-content:deep(a:hover) {
  text-decoration: underline;
}

.release-content:deep(blockquote) {
  margin: 1rem 0;
  padding: 0.5rem 1rem;
  border-left: 3px solid var(--vp-c-brand-1);
  background: var(--vp-c-bg-alt);
  border-radius: 0 8px 8px 0;
  color: var(--vp-c-text-2);
}

/* Empty State */
.empty {
  padding: 4rem 0;
  text-align: center;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.empty p {
  color: var(--vp-c-text-2);
  font-size: 1.1rem;
  margin: 0 0 0.5rem;
}

.empty-hint {
  color: var(--vp-c-text-3);
  font-size: 0.9rem;
}

/* Responsive */
@media (max-width: 960px) {
  .changelog-sidebar {
    display: none;
  }
}

@media (max-width: 640px) {
  .releases-list {
    gap: 2rem;
  }

  .release-card {
    padding-bottom: 2rem;
  }

  .release-title {
    font-size: 1.35rem;
  }
}
</style>
