<script setup lang="ts">
import { ref, computed } from 'vue'

/**
 * DataTable — Sortable data table with column definitions and row data.
 * Supports sorting by clicking column headers.
 */

export interface DataTableColumn {
  /** Unique key matching the row data property name. */
  key: string
  /** Display label for the column header. */
  label: string
  /** Whether this column is sortable. Defaults to true. */
  sortable?: boolean
  /** Alignment. Defaults to 'left'. */
  align?: 'left' | 'right' | 'center'
}

const props = defineProps<{
  /** Column definitions. */
  columns: DataTableColumn[]
  /** Array of row objects. Each row should have properties matching column keys. */
  rows: Record<string, unknown>[]
}>()

const sortKey = ref<string | null>(null)
const sortDirection = ref<'asc' | 'desc'>('asc')

function toggleSort(key: string) {
  if (sortKey.value === key) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortKey.value = key
    sortDirection.value = 'asc'
  }
}

const sortedRows = computed(() => {
  if (!sortKey.value) return props.rows

  const key = sortKey.value
  const dir = sortDirection.value === 'asc' ? 1 : -1

  return [...props.rows].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    if (typeof aVal === 'number' && typeof bVal === 'number') return (aVal - bVal) * dir
    return String(aVal).localeCompare(String(bVal)) * dir
  })
})

function alignClass(align?: 'left' | 'right' | 'center'): string {
  if (align === 'right') return 'text-right'
  if (align === 'center') return 'text-center'
  return 'text-left'
}
</script>

<template>
  <div class="overflow-x-auto rounded-lg border border-zinc-800">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-zinc-800 bg-zinc-900/50">
          <th
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-2.5 text-xs font-medium text-zinc-500 uppercase tracking-wider select-none"
            :class="[
              alignClass(col.align),
              (col.sortable !== false) ? 'cursor-pointer hover:text-zinc-300' : ''
            ]"
            @click="col.sortable !== false ? toggleSort(col.key) : undefined"
          >
            <span class="inline-flex items-center gap-1">
              {{ col.label }}
              <span v-if="sortKey === col.key" class="text-zinc-400">
                {{ sortDirection === 'asc' ? '↑' : '↓' }}
              </span>
            </span>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="(row, index) in sortedRows"
          :key="index"
          class="border-b border-zinc-800/50 hover:bg-zinc-900/30 transition-colors"
        >
          <td
            v-for="col in columns"
            :key="col.key"
            class="px-4 py-2.5 text-zinc-300"
            :class="alignClass(col.align)"
          >
            <!-- Named slot for custom cell rendering, fallback to raw value -->
            <slot :name="`cell-${col.key}`" :row="row" :value="row[col.key]">
              {{ row[col.key] }}
            </slot>
          </td>
        </tr>
        <tr v-if="sortedRows.length === 0">
          <td :colspan="columns.length" class="px-4 py-8 text-center text-zinc-500 text-sm">
            No data
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
