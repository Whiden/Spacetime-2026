<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import { computed } from 'vue'

defineProps<{
  collapsed: boolean
}>()

defineEmits<{
  (e: 'toggle'): void
}>()

const route = useRoute()

const navItems = [
  { name: 'Dashboard', path: '/', icon: 'grid' },
  { name: 'Colonies', path: '/colonies', icon: 'globe' },
  { name: 'Corporations', path: '/corporations', icon: 'building' },
  { name: 'Contracts', path: '/contracts', icon: 'file-text' },
  { name: 'Fleet', path: '/fleet', icon: 'anchor' },
  { name: 'Science', path: '/science', icon: 'flask' },
  { name: 'Market', path: '/market', icon: 'bar-chart' },
  { name: 'Galaxy', path: '/galaxy', icon: 'star' },
  { name: 'Settings', path: '/settings', icon: 'settings' },
]

// Match active route: exact for dashboard, startsWith for others
function isActive(path: string): boolean {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}
</script>

<template>
  <aside
    class="flex flex-col bg-zinc-900 border-r border-zinc-800 transition-all duration-200"
    :class="collapsed ? 'w-16' : 'w-56'"
  >
    <!-- Logo / Title -->
    <div class="flex items-center h-14 px-4 border-b border-zinc-800">
      <span class="text-lg font-semibold text-white tracking-wide" v-if="!collapsed">
        Spacetime
      </span>
      <span class="text-lg font-semibold text-white" v-else>S</span>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 py-2 overflow-y-auto">
      <RouterLink
        v-for="item in navItems"
        :key="item.path"
        :to="item.path"
        class="flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm font-medium transition-colors duration-150"
        :class="
          isActive(item.path)
            ? 'bg-indigo-600/20 text-indigo-400'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        "
      >
        <!-- Icon placeholder — simple text-based icons -->
        <span class="w-5 h-5 flex items-center justify-center text-xs shrink-0">
          {{ item.icon === 'grid' ? '▦' : '' }}
          {{ item.icon === 'globe' ? '◉' : '' }}
          {{ item.icon === 'building' ? '▣' : '' }}
          {{ item.icon === 'file-text' ? '▤' : '' }}
          {{ item.icon === 'anchor' ? '⚓' : '' }}
          {{ item.icon === 'flask' ? '⚗' : '' }}
          {{ item.icon === 'bar-chart' ? '▥' : '' }}
          {{ item.icon === 'star' ? '★' : '' }}
          {{ item.icon === 'settings' ? '⚙' : '' }}
        </span>
        <span v-if="!collapsed">{{ item.name }}</span>
      </RouterLink>
    </nav>

    <!-- Collapse toggle -->
    <button
      class="flex items-center justify-center h-10 border-t border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
      @click="$emit('toggle')"
    >
      <span v-if="collapsed">→</span>
      <span v-else>←</span>
    </button>
  </aside>
</template>
