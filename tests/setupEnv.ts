import { config } from 'dotenv'
import path from 'path'

// Локально — .env с реальным dev-DATABASE_URL. В CI (.github/workflows/test.yml)
// DATABASE_URL уже задан переменной окружения эфемерного Postgres-сервиса —
// override:false здесь не перезапишет её .env-файлом, которого в CI и нет.
config({ path: path.resolve(__dirname, '../.env'), quiet: true })
