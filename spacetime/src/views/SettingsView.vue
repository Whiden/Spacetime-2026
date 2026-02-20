<script setup lang="ts">
/**
 * SettingsView.vue — Story 18.3: Settings screen with save/load interface.
 *
 * Features:
 *   - Autosave slot (load only)
 *   - 3 manual save slots (save with overwrite confirm, load with confirm)
 *   - Export to JSON file
 *   - Import from JSON file
 *   - New Game button with confirmation
 */

import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSaveLoad } from '../composables/useSaveLoad'
import { useGameStore } from '../stores/game.store'
import ConfirmDialog from '../components/shared/ConfirmDialog.vue'
import type { SaveSlotInfo } from '../composables/useSaveLoad'

const router = useRouter()
const gameStore = useGameStore()
const saveLoad = useSaveLoad()

// ─── Confirm Dialog State ─────────────────────────────────────────────────────

const confirmDialog = ref({
  open: false,
  title: '',
  message: '',
  onConfirm: () => {},
})

function openConfirm(title: string, message: string, onConfirm: () => void) {
  confirmDialog.value = { open: true, title, message, onConfirm }
}

function closeConfirm() {
  confirmDialog.value.open = false
}

// ─── File Import ──────────────────────────────────────────────────────────────

const fileInputRef = ref<HTMLInputElement | null>(null)

function triggerFileInput() {
  fileInputRef.value?.click()
}

async function handleFileImport(event: Event) {
  const input = event.target as HTMLInputElement
  const state = await saveLoad.importFromJson(input.files)
  if (state) {
    openConfirm(
      'Load Imported Save?',
      `Turn ${state.turn} save file detected. Load it now?`,
      () => {
        gameStore.loadGame(state)
        closeConfirm()
        router.push('/')
      },
    )
  }
  // Reset file input so the same file can be picked again
  input.value = ''
}

// ─── Save / Load Actions ──────────────────────────────────────────────────────

function handleSave(slot: SaveSlotInfo) {
  const slotNum = slot.slot as number
  const slotLabel = `Slot ${slotNum + 1}`
  const gameState = gameStore.getFullGameState()

  if (slot.occupied) {
    openConfirm(
      `Overwrite ${slotLabel}?`,
      `${slotLabel} contains a save from Turn ${slot.turn}. Overwrite it?`,
      () => {
        saveLoad.saveToSlot(slotNum, gameState)
        closeConfirm()
      },
    )
  } else {
    saveLoad.saveToSlot(slotNum, gameState)
  }
}

function handleLoad(slot: SaveSlotInfo) {
  const label = slot.slot === 'auto' ? 'Autosave' : `Slot ${(slot.slot as number) + 1}`
  openConfirm(
    `Load ${label}?`,
    `Load the save from Turn ${slot.turn}? Unsaved progress will be lost.`,
    () => {
      const state = saveLoad.loadFromSlot(slot.slot)
      if (state) {
        gameStore.loadGame(state)
        closeConfirm()
        router.push('/')
      } else {
        closeConfirm()
      }
    },
  )
}

function handleExport() {
  const gameState = gameStore.getFullGameState()
  saveLoad.exportToJson(gameState)
}

function handleNewGame() {
  openConfirm(
    'Start New Game?',
    'This will erase your current progress and start a fresh game. Are you sure?',
    () => {
      gameStore.initializeGame()
      closeConfirm()
      router.push('/')
    },
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
</script>

<template>
  <div>
    <h1 class="text-2xl font-semibold text-white mb-6">Settings</h1>

    <!-- Feedback messages -->
    <div v-if="saveLoad.successMessage.value" class="mb-4 rounded-lg border border-emerald-700 bg-emerald-900/40 px-4 py-2 text-emerald-300 text-sm">
      {{ saveLoad.successMessage.value }}
    </div>
    <div v-if="saveLoad.errorMessage.value" class="mb-4 rounded-lg border border-red-700 bg-red-900/40 px-4 py-2 text-red-300 text-sm">
      {{ saveLoad.errorMessage.value }}
    </div>

    <!-- ── Autosave Slot ────────────────────────────────────────────────────── -->
    <section class="mb-6">
      <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Autosave</h2>

      <div
        v-for="slot in saveLoad.slotList.value.filter(s => s.slot === 'auto')"
        :key="String(slot.slot)"
        class="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4"
      >
        <div>
          <p class="text-white font-medium">{{ slot.name }}</p>
          <p v-if="slot.occupied" class="text-zinc-400 text-xs mt-0.5">
            Turn {{ slot.turn }} &middot; {{ formatDate(slot.dateSaved) }}
          </p>
          <p v-else class="text-zinc-500 text-xs mt-0.5">No autosave yet</p>
        </div>
        <button
          :disabled="!slot.occupied"
          class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
          :class="slot.occupied
            ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
            : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'"
          @click="slot.occupied && handleLoad(slot)"
        >
          Load
        </button>
      </div>
    </section>

    <!-- ── Manual Save Slots ───────────────────────────────────────────────── -->
    <section class="mb-6">
      <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">Save Slots</h2>

      <div class="flex flex-col gap-3">
        <div
          v-for="slot in saveLoad.slotList.value.filter(s => s.slot !== 'auto')"
          :key="String(slot.slot)"
          class="flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4"
        >
          <div>
            <p class="text-white font-medium">{{ slot.name }}</p>
            <p v-if="slot.occupied" class="text-zinc-400 text-xs mt-0.5">
              Turn {{ slot.turn }} &middot; {{ formatDate(slot.dateSaved) }}
            </p>
            <p v-else class="text-zinc-500 text-xs mt-0.5">Empty</p>
          </div>
          <div class="flex gap-2">
            <button
              class="px-4 py-1.5 rounded-lg text-sm font-medium bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
              @click="handleSave(slot)"
            >
              Save
            </button>
            <button
              :disabled="!slot.occupied"
              class="px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              :class="slot.occupied
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'"
              @click="slot.occupied && handleLoad(slot)"
            >
              Load
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- ── File Transfer ───────────────────────────────────────────────────── -->
    <section class="mb-6">
      <h2 class="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">File Transfer</h2>

      <div class="flex gap-3">
        <button
          class="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-5 py-4 text-left transition-colors"
          @click="handleExport"
        >
          <p class="text-white font-medium">Export to File</p>
          <p class="text-zinc-400 text-xs mt-0.5">Download current game as a .json file</p>
        </button>

        <button
          class="flex-1 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 px-5 py-4 text-left transition-colors"
          @click="triggerFileInput"
        >
          <p class="text-white font-medium">Import from File</p>
          <p class="text-zinc-400 text-xs mt-0.5">Load a previously exported .json save</p>
        </button>
      </div>

      <!-- Hidden file input -->
      <input
        ref="fileInputRef"
        type="file"
        accept=".json,application/json"
        class="hidden"
        @change="handleFileImport"
      />
    </section>

    <!-- ── Danger Zone ─────────────────────────────────────────────────────── -->
    <section>
      <h2 class="text-sm font-medium text-red-400 uppercase tracking-wider mb-3">Danger Zone</h2>

      <div class="rounded-xl border border-red-800/50 bg-red-950/20 px-5 py-4 flex items-center justify-between">
        <div>
          <p class="text-white font-medium">New Game</p>
          <p class="text-zinc-400 text-xs mt-0.5">Erase all progress and start from scratch</p>
        </div>
        <button
          class="px-4 py-1.5 rounded-lg text-sm font-medium bg-red-700 hover:bg-red-600 text-white transition-colors"
          @click="handleNewGame"
        >
          New Game
        </button>
      </div>
    </section>

    <!-- Confirm Dialog -->
    <ConfirmDialog
      v-if="confirmDialog.open"
      :title="confirmDialog.title"
      :message="confirmDialog.message"
      @confirm="confirmDialog.onConfirm()"
      @cancel="closeConfirm"
    />
  </div>
</template>
