<script setup lang="ts">
import { NConfigProvider, NMessageProvider, type GlobalThemeOverrides } from 'naive-ui'
import HomeView from './components/HomeView.vue'

const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#16a34a',
    primaryColorHover: '#22c55e',
    primaryColorPressed: '#15803d',
    primaryColorSuppl: '#16a34a',
    successColor: '#16a34a',
    successColorHover: '#22c55e',
    successColorPressed: '#15803d',
    warningColor: '#b45309',
    warningColorHover: '#d97706',
    warningColorPressed: '#92400e',
    errorColor: '#dc2626',
    errorColorHover: '#ef4444',
    errorColorPressed: '#b91c1c',
    borderRadius: '10px',
    borderRadiusSmall: '7px',
    fontFamily:
      '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
  },
  Button: {
    borderRadiusLarge: '999px',
    heightLarge: '46px',
    paddingLarge: '0 24px',
  },
  Slider: {
    railColor: '#dcfce7',
    railColorActive: '#16a34a',
  },
}
</script>

<template>
  <n-config-provider :theme-overrides="themeOverrides">
    <n-message-provider>
      <home-view />
    </n-message-provider>
  </n-config-provider>
</template>
