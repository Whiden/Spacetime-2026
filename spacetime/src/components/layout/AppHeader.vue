<script setup lang="ts">
import { ref } from 'vue'
import { useBudgetDisplay } from '../../composables/useBudgetDisplay'
import { useTurnActions } from '../../composables/useTurnActions'
import { useEventStore } from '../../stores/event.store'
import ConfirmDialog from '../shared/ConfirmDialog.vue'
import AppNotifications from './AppNotifications.vue'

const {
  currentBP,
  incomeDisplay,
  expensesDisplay,
  netDisplay,
  bpColorClass,
  netColorClass,
} = useBudgetDisplay()

const {
  showConfirm,
  canEndTurn,
  isResolving,
  currentTurn,
  income,
  expenses,
  net,
  willCreateDebt,
  requestEndTurn,
  cancelEndTurn,
  confirmEndTurn,
} = useTurnActions()

const eventStore = useEventStore()

/** Whether the notification overlay panel is open. */
const notificationsOpen = ref(false)
</script>

<template>
  <header class="flex items-center justify-between h-14 px-6 bg-zinc-900 border-b border-zinc-800">
    <!-- Left: Turn info -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Turn</span>
        <span class="text-sm font-semibold text-white">{{ currentTurn }}</span>
      </div>
    </div>

    <!-- Center: Budget -->
    <div class="flex items-center gap-6">
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">BP</span>
        <span class="text-sm font-semibold" :class="bpColorClass">{{ currentBP }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Income</span>
        <span class="text-sm text-emerald-400">{{ incomeDisplay }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Expenses</span>
        <span class="text-sm text-zinc-300">{{ expensesDisplay }}</span>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-zinc-500 uppercase tracking-wider">Net</span>
        <span class="text-sm" :class="netColorClass">{{ netDisplay }}</span>
      </div>
    </div>

    <!-- Right: Notification badge + End Turn -->
    <div class="flex items-center gap-3">
      <!-- Notification bell with unread badge -->
      <button
        class="relative p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors"
        title="Notifications"
        @click="notificationsOpen = !notificationsOpen"
      >
        <!-- Bell icon (unicode) -->
        <span class="text-base leading-none">🔔</span>
        <!-- Unread count badge -->
        <span
          v-if="eventStore.unreadCount > 0"
          class="absolute -top-1 -right-1 min-w-[1.1rem] h-[1.1rem] flex items-center justify-center
                 rounded-full bg-red-600 text-[9px] font-bold text-white px-1"
        >
          {{ eventStore.unreadCount > 99 ? '99+' : eventStore.unreadCount }}
        </span>
      </button>

      <button
        :disabled="!canEndTurn"
        :class="canEndTurn
          ? 'bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer'
          : 'bg-indigo-600/50 text-indigo-300 cursor-not-allowed opacity-50'"
        class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
        @click="requestEndTurn"
      >
        {{ isResolving ? 'Resolving...' : 'End Turn' }}
      </button>
    </div>

    <!-- Confirmation Dialog -->
    <ConfirmDialog
      v-if="showConfirm"
      title="End Turn?"
      :message="`Budget: +${income} income − ${expenses} expenses = ${net > 0 ? '+' : ''}${net} BP net${willCreateDebt ? '\n\nDeficit detected — debt tokens will be created.' : ''}`"
      confirm-label="End Turn"
      @confirm="confirmEndTurn"
      @cancel="cancelEndTurn"
    />

    <!-- Notification overlay panel -->
    <AppNotifications
      v-if="notificationsOpen"
      @close="notificationsOpen = false"
    />
  </header>
</template>
