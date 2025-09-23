# 🎮 Confidential Mines UI

This is the frontend application for **Confidential Mines**, a fully homomorphic encryption (FHE) powered
Minesweeper-style game built with **Vite, React.js, and TypeScript**.

Players pick tiles on an encrypted board — bomb positions remain **confidential** thanks to FHEVM, ensuring fairness and
privacy onchain.

---

## 🚀 Getting Started

### Prerequisites

Make sure you have the following installed:

- **Node.js** (v18+ recommended)
- **npm** or **yarn**

---

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/phamnhungoctuan/Confidential-Mines-Repo
cd frontend
npm install
```

---

## ⚙️ Environment Variables

This project uses environment variables for configuration.

### Setup

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` and update values as needed:

```bash
VITE_CONTRACT_ADDRESS="0x3115579c839E357032dA49C4B3Bc33127eca474f"
VITE_VERIFY_SERVER=https://confidential-mines-verify.vercel.app/api/verify
```

---

## 📜 Available Commands

In the project directory, you can run:

```bash
npm run dev
```

Starts the development server with Vite. Accessible at:

- Local: [http://localhost:5174](http://localhost:5174)

```bash
npm run build
```

Builds the project for production. The output will be in the `dist/` folder.

```bash
npm run preview
```

Locally preview the production build. Runs a local server to serve files from the `dist/` folder.

```bash
npm run lint
```

Runs ESLint to check for code quality and style issues.

---

## 🛠️ Tech Stack

- **Vite**
- **React.js**
- **TypeScript**
- **FHEVM SDK**
- **ESLint**
