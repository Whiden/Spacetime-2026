import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
    {
      path: '/colonies',
      name: 'colonies',
      component: () => import('@/views/ColoniesView.vue'),
    },
    {
      path: '/colonies/:id',
      name: 'colony-detail',
      component: () => import('@/views/ColonyDetailView.vue'),
    },
    {
      path: '/corporations',
      name: 'corporations',
      component: () => import('@/views/CorporationsView.vue'),
    },
    {
      path: '/corporations/:id',
      name: 'corp-detail',
      component: () => import('@/views/CorpDetailView.vue'),
    },
    {
      path: '/contracts',
      name: 'contracts',
      component: () => import('@/views/ContractsView.vue'),
    },
    {
      path: '/fleet',
      name: 'fleet',
      component: () => import('@/views/FleetView.vue'),
    },
    {
      path: '/science',
      name: 'science',
      component: () => import('@/views/ScienceView.vue'),
    },
    {
      path: '/market',
      name: 'market',
      component: () => import('@/views/MarketView.vue'),
    },
    {
      path: '/galaxy',
      name: 'galaxy',
      component: () => import('@/views/GalaxyView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('@/views/SettingsView.vue'),
    },
  ],
})

export default router
