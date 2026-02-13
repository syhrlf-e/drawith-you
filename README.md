# 🎨 Drawith

**Drawith** is a real-time collaborative drawing application built with **Next.js 14** and **Firebase**. It allows multiple users to draw, write, and design together on a shared digital canvas instantly.

![Drawith Preview](./public/preview.png)
...
git clone https://github.com/yourusername/drawith.git
cd drawith

## ✨ Key Features

- **Real-time Collaboration**: See strokes and changes from other users instantly (powered by Firebase Realtime Database).
- **Advanced Tools**:
  - **Pen & Eraser**: Smooth, pressure-simulated drawing.
  - **Text Tool**: Click-to-edit text with **Smart Contrast** (auto-switches Black/White based on background).
  - **Fill Bucket**: Flood fill areas with color.
  - **Select/Move**: Drag and drop any object (text or drawings) across the canvas.
- **Pro Color Picker**:
  - **Figma-style** color wheel and saturation control.
  - **Eye Dropper**: Pick colors directly from your canvas.
  - **History**: Automatically saves your recently used colors.
  - **Hex Input**: For precise color selection.
- **Smart History**:
  - **Undo/Redo**: Works for strokes, text, and even **Background Color changes**.
  - **Auto-Save**: Room state is persisted automatically.
- **Responsive Design**: Works on Desktop, Tablet, and Mobile.

## 🛠️ Tech Stack

- **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Backend/DB**: [Firebase Realtime Database](https://firebase.google.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Color**: [React Colorful](https://github.com/omgovich/react-colorful)

## 🚀 Getting Started

Follow these steps to run the project locally:

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/drawith.git
cd drawith
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
# or
pnpm install
```

### 3. Configure Firebase

1.  Go to [Firebase Console](https://console.firebase.google.com/).
2.  Create a new project.
3.  Enable **Realtime Database** (Start in **Test Mode** for development).
4.  Copy your web app configuration.
5.  Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project_id.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## 🤝 How to Use

1.  **Create a Room**: Click "Mulai Gambar" or "Buat Room" on the home page.
2.  **Share**: Copy the URL and send it to a friend.
3.  **Collaborate**: Open the link on another device/browser and start drawing together!

## 📄 License

This project is licensed under the [MIT License](LICENSE).
