# Инструкции по сборке NEXO

## Подготовка к сборке

### 1. Установка EAS CLI

```bash
npm install -g eas-cli
```

### 2. Создание Expo аккаунта

Если у вас ещё нет аккаунта:
```bash
eas login
```

Если аккаунт уже есть:
```bash
eas login
```

### 3. Настройка проекта

```bash
cd /path/to/NEXO
eas init
```

Выберите существующий проект или создайте новый.

### 4. Генерация ключей для Android

```bash
eas credentials
```

Выберите:
1. Platform: Android
2. Generate new keystore

Сохраняйте полученные ключи в безопасном месте!

## Сборка APK для Android

### Вариант 1: Preview (тестовая версия)

```bash
npm run build-preview
```

или

```bash
eas build --platform android --profile preview
```

Это создаст APK файл, который можно установить на устройство для тестирования.

### Вариант 2: Production (релизная версия)

```bash
npm run build-production
```

или

```bash
eas build --platform android --profile production
```

Это создаст релизную версию APK с минимизацией и оптимизацией.

## Вы можете тестировать после завершения сборки

1. Сборка займет около 10-15 минут
2. Вы получите ссылку для скачивания APK файла
3. Скачайте APK на Android устройство
4. Установите APK через File Manager или используя `adb install`

## Установка APK вручную на Android устройство

### Вариант 1: Используя Android Debug Bridge (adb)

```bash
# Убедитесь, что Android SDK Platform-Tools установлен
adb install /path/to/NEXO.apk
```

### Вариант 2: Через файловый менеджер

1. Скопируйте APK файл на Android устройство
2. Откройте файловый менеджер
3. Найдите и откройте APK файл
4. Нажмите "Установить"
5. После установки откройте приложение

### Вариант 3: Через компьютер с помощью Android Studio

1. Откройте Android Studio
2. Выберите Emulator или подключенное устройство
3. Перейдите Device Manager
4. Выберите Install APK
5. Выберите файл APK

## Получение APK файла после сборки

1. После завершения сборки вы получите уведомление
2. В консоли будет ссылка на скачивание или ID сборки
3. Используйте ID сборки для получения информации о сборке:

```bash
eas build:view <BUILD_ID>
```

или

```bash
eas build:list
```

Для просмотра всех сборок.

## Отладка при сборке

### Просмотр логов сборки

```bash
eas build:view <BUILD_ID> --logs
```

### Отмена текущей сборки

```bash
eas build:cancel <BUILD_ID>
```

### Повторная сборка

```bash
eas build --platform android --profile production --wait
```

## Тестирование локально перед сборкой

Перед публикацией рекомендуется протестировать локально:

```bash
npm run android
```

Это установит приложение на подключенное устройство или эмулятор для локального тестирования.

## Публикация в Google Play Store

### 1. Создание аккаунта Google Play Developer

Посетите [Google Play Console](https://play.google.com/console)
- Создайте аккаунт разработчика ($25 один раз)
- Заполните информацию о компании/разработчике

### 2. Создание приложения

1. Нажмите "Create app"
2. Заполните:
   - Название: NEXO
   - Язык по умолчанию
   - Тип приложения: Apps
   - Категория: Communication
   - Email

### 3. Подготовка к загрузке

В `eas.json`:

```json
{
  "submit": {
    "production": {
      "android": {
        "serviceAccount": "./service-account-key.json",
        "track": "internal"
      }
    }
  }
}
```

### 4. Загрузка в Play Store

```bash
npm run submit-android
```

или

```bash
eas submit --platform android --latest
```

## Подготовка для iOS (будущее)

### Требования

- Apple Developer Account ($99/год)
- Mac с Xcode
- iOS Device для тестирования

### Сборка для iOS

```bash
npm run build-ios
```

### Подготовка сертификатов

```bash
eas credentials
```

Выберите:
1. Platform: iOS
2. Generate credentials

## Environment Configuration

Убедитесь, что правильно установлены переменные окружения:

```bash
# .env.local
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Версионирование

При каждом обновлении обновляйте версию в `app.json`:

```json
{
  "expo": {
    "version": "1.0.1",
    "android": {
      "versionCode": 2
    }
  }
}
```

## Размер APK

Текущий приложение занимает примерно 150-200 MB (из-за node_modules, но будет оптимизировано при сборке до 40-50 MB).

## Полезные команды

```bash
# Просмотр всех сборок
eas build:list

# Отмена сборки
eas build:cancel <BUILD_ID>

# Просмотр логов
eas build:view <BUILD_ID> --logs

# Загрузить на Play Store
eas submit --platform android

# Проверить конфигурацию
npx eas build --platform android --status
```

## Troubleshooting

### Проблема: "Failed to build"

**Решение**: 
1. Проверьте логи: `eas build:view <BUILD_ID> --logs`
2. Убедитесь, что все зависимости установлены
3. Очистите кэш: `npx expo prebuild --clean`

### Проблема: "Invalid keystore"

**Решение**:
1. Удалите старые ключи: `eas credentials --platform android --reset`
2. Создайте новые ключи: `eas credentials`

### Проблема: "APK не устанавливается на устройство"

**Решение**:
1. Убедитесь, что Android версия совместима (минимум Android 6.0)
2. Включите установку из неизвестных источников
3. Удалите старую версию приложения перед установкой

## Дополнительные ресурсы

- [Expo Build Documentation](https://docs.expo.dev/build)
- [EAS Submit Documentation](https://docs.expo.dev/submit)
- [Google Play Console](https://play.google.com/console)
- [Android Developer Documentation](https://developer.android.com/docs)

---

**Последнее обновление**: 2026-11-08
