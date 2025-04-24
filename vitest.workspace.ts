import { defineWorkspace } from 'vitest/config'

// Define the workspace using a glob pattern for the packages directory
export default defineWorkspace([
  'packages/*'
])