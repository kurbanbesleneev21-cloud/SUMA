import type { Locale } from '@/i18n';

export type LegalDoc = 'privacy' | 'terms' | 'help';

interface Doc {
  title: string;
  updated: string;
  sections: { h: string; p: string }[];
}

export const legalDocs: Record<Locale, Record<LegalDoc, Doc>> = {
  ru: {
    privacy: {
      title: 'Политика конфиденциальности',
      updated: 'Редакция от 9 ноября 2026 г. (обновлена: файлы и звонки)',
      sections: [
        { h: 'Кратко', p: 'NEXO создан так, чтобы сервер не мог прочитать ваши сообщения. Текст переписки шифруется на вашем телефоне до отправки и расшифровывается только на телефоне собеседника.' },
        { h: 'Что хранится на сервере', p: 'Email и хэш пароля (служба Supabase Auth). Имя, username, описание профиля, дата регистрации, публичный ключ шифрования. Список ваших чатов и их участников, время отправки и размер зашифрованных сообщений. Время последнего посещения, контакты, блокировки и настройки приватности. Зашифрованный текст сообщений и зашифрованные файлы (фото, видео, документы) — без ключей для их расшифровки. Сведения о звонках: кто кому звонил, когда и сколько длился разговор.' },
        { h: 'Что не хранится на сервере', p: 'Открытый текст сообщений и ваш секретный ключ шифрования. Секретный ключ хранится только в защищённом хранилище телефона (Android Keystore / iOS Keychain). PIN-код блокировки приложения хранится только на телефоне в виде хэша.' },
        { h: 'Кто видит ваши данные', p: 'Другие пользователи видят ваше имя, username, описание и дату регистрации. Ваш email не виден никому из пользователей. Время посещения и статус «в сети» видны в соответствии с вашими настройками конфиденциальности.' },
        { h: 'Где хранятся данные', p: 'Сервер базы данных и файлов находится в дата-центре Supabase (регион eu-central-1, Франкфурт, Германия). Голос и видео во время звонков передаются через сервис LiveKit Cloud; медиапоток шифруется ключом, который знают только участники звонка, а LiveKit видит лишь технические данные соединения.' },
        { h: 'Удаление данных', p: 'Вы можете удалить аккаунт в разделе «Настройки → Безопасность». При этом с сервера безвозвратно удаляются профиль, ваши сообщения, контакты, настройки и участие в чатах.' },
        { h: 'Ограничения', p: 'Сервер видит метаданные: с кем вы переписываетесь, когда и сколько. Шифрование пока не прошло независимый аудит. Если удалить приложение или потерять телефон, расшифровать старые сообщения будет невозможно.' },
        { h: 'Изменения', p: 'При изменении политики мы обновим эту страницу и дату редакции.' },
      ],
    },
    terms: {
      title: 'Условия использования',
      updated: 'Редакция от 9 ноября 2026 г. (обновлена: файлы и звонки)',
      sections: [
        { h: 'Использование сервиса', p: 'NEXO — мессенджер для личного общения. Регистрируясь, вы подтверждаете, что указали действующий email и не будете использовать сервис для нарушения закона, рассылки спама, мошенничества или преследования других людей.' },
        { h: 'Аккаунт', p: 'Вы отвечаете за сохранность пароля и доступа к телефону. Username должен быть уникальным и не может выдавать себя за другого человека или организацию.' },
        { h: 'Содержимое', p: 'Вы отвечаете за содержимое, которое отправляете. Поскольку сообщения зашифрованы, мы не можем их просматривать. Пользователи могут блокировать нежелательных собеседников.' },
        { h: 'Доступность', p: 'Сервис предоставляется «как есть». Мы стараемся обеспечить стабильную работу, но не гарантируем отсутствие перерывов.' },
        { h: 'Прекращение', p: 'Вы можете удалить аккаунт в любой момент. Аккаунты, нарушающие эти условия, могут быть заблокированы.' },
      ],
    },
    help: {
      title: 'Помощь',
      updated: '',
      sections: [
        { h: 'Как начать переписку?', p: 'Откройте вкладку «Контакты» или нажмите карандаш на экране «Чаты», найдите собеседника по username и нажмите «Написать».' },
        { h: 'Почему сообщение «не удалось расшифровать»?', p: 'Оно зашифровано для другого ключа: например, вы переустановили приложение или вошли с другого телефона. Восстановить такие сообщения невозможно — так устроено шифрование.' },
        { h: 'Как проверить, что переписку никто не подслушивает?', p: 'Откройте профиль собеседника и сравните «Код безопасности» с тем, что он видит у себя в «Настройки → Безопасность → Шифрование».' },
        { h: 'Закрепление, архив, отключение звука', p: 'Удерживайте палец на чате в списке — откроется меню действий.' },
        { h: 'Я забыл PIN-код', p: 'PIN-код хранится только на телефоне. Если вы его забыли, переустановите приложение и войдите заново (старые сообщения на этом телефоне станут недоступны).' },
      ],
    },
  },
  en: {
    privacy: {
      title: 'Privacy Policy',
      updated: 'Version of 9 November 2026 (updated: files and calls)',
      sections: [
        { h: 'In short', p: 'NEXO is built so that the server cannot read your messages. Message text is encrypted on your phone before sending and decrypted only on the recipient’s phone.' },
        { h: 'What the server stores', p: 'Email and password hash (Supabase Auth). Name, username, bio, sign-up date, public encryption key. Your chats and their members, the time and size of encrypted messages. Last seen time, contacts, blocks and privacy settings. Encrypted message text and encrypted files (photos, videos, documents) — without the keys to decrypt them. Call records: who called whom, when and for how long.' },
        { h: 'What the server never stores', p: 'Plain message text and your secret encryption key. The secret key lives only in the phone’s secure storage (Android Keystore / iOS Keychain). The app lock PIN is stored only on the phone, as a hash.' },
        { h: 'Who sees your data', p: 'Other users see your name, username, bio and sign-up date. Your email is never shown to other users. Last seen and online status follow your privacy settings.' },
        { h: 'Where data is stored', p: 'The database and file storage run in a Supabase data centre (eu-central-1, Frankfurt, Germany). Call audio and video are relayed by LiveKit Cloud; the media stream is encrypted with a key known only to the call participants, and LiveKit sees only technical connection data.' },
        { h: 'Deleting data', p: 'You can delete your account in Settings → Security. Your profile, messages, contacts, settings and chat memberships are permanently removed from the server.' },
        { h: 'Limitations', p: 'The server sees metadata: who you talk to, when and how much. The encryption has not been independently audited yet. If you delete the app or lose the phone, old messages cannot be decrypted.' },
        { h: 'Changes', p: 'If this policy changes, we will update this page and its date.' },
      ],
    },
    terms: {
      title: 'Terms of Use',
      updated: 'Version of 9 November 2026 (updated: files and calls)',
      sections: [
        { h: 'Using the service', p: 'NEXO is a messenger for personal communication. By signing up you confirm that your email is valid and that you will not use the service for illegal activity, spam, fraud or harassment.' },
        { h: 'Account', p: 'You are responsible for keeping your password and phone safe. Usernames must be unique and must not impersonate other people or organisations.' },
        { h: 'Content', p: 'You are responsible for what you send. Messages are encrypted, so we cannot view them. Users can block unwanted contacts.' },
        { h: 'Availability', p: 'The service is provided “as is”. We aim for stable operation but do not guarantee it will be uninterrupted.' },
        { h: 'Termination', p: 'You may delete your account at any time. Accounts that violate these terms may be suspended.' },
      ],
    },
    help: {
      title: 'Help',
      updated: '',
      sections: [
        { h: 'How do I start a chat?', p: 'Open Contacts or tap the pencil on the Chats screen, find someone by username and tap Message.' },
        { h: 'Why “could not decrypt”?', p: 'The message was encrypted for another key: for example, you reinstalled the app or signed in on another phone. Such messages cannot be recovered — that is how the encryption works.' },
        { h: 'How do I verify nobody is listening?', p: 'Open the contact’s profile and compare the Safety code with what they see in Settings → Security → Encryption.' },
        { h: 'Pin, archive, mute', p: 'Long-press a chat in the list to open the actions menu.' },
        { h: 'I forgot my PIN', p: 'The PIN is stored only on the phone. If you forgot it, reinstall the app and sign in again (old messages on this phone will become unavailable).' },
      ],
    },
  },
};
