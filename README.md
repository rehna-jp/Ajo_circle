# Ajo Circle

A decentralised rotating savings circle (ROSCA) built on **Celo Mainnet**, denominated in **G$ (GoodDollar)** tokens. Members pool contributions each round; the full pot rotates to one member per round until every member has received a payout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | [Foundry](https://book.getfoundry.sh/) · Solidity ^0.8.20 · OpenZeppelin v5 |
| Frontend | [Next.js 14](https://nextjs.org/) (App Router) · TypeScript · Tailwind CSS |
| Wallet auth | [Privy](https://privy.io/) (email + embedded wallet fallback) |
| Chain interaction | [wagmi v2](https://wagmi.sh/) · [viem v2](https://viem.sh/) |
| Chain | Celo Mainnet (chainId **42220**) |

---

## Repository Layout

```
Ajo_circle/
├── contracts/             # Foundry project
│   ├── src/
│   │   ├── AjoCircle.sol
│   │   ├── AjoFactory.sol
│   │   └── AjoYieldVault.sol
│   ├── interfaces/
│   │   └── IIdentity.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   ├── test/
│   │   ├── AjoCircle.t.sol
│   │   ├── AjoFactory.t.sol
│   │   └── AjoYieldVault.t.sol
│   └── foundry.toml
├── frontend/              # Next.js app
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   └── public/
│   ├── public/
│   ├── package.json
│   ├── tsconfig.json
│   └── tailwind.config.ts
├── .github/
│   └── workflows/
│       └── ci.yml
├── package.json           # repo npm workspace + scripts
├── package-lock.json
└── README.md
```

---

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 |
| Foundry | latest (`foundryup`) |
| Git | any |

Install Foundry if you haven't:

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

---

## Setup

### 1. Clone & install

```bash
git clone <repo-url> ajo-circle
cd ajo-circle

# Install frontend dependencies
npm install

# Install Foundry contract dependencies (git submodules)
cd contracts
forge install OpenZeppelin/openzeppelin-contracts
forge install foundry-rs/forge-std
cd ..
```

### 2. Configure environment

```bash
cp frontend/.env.example frontend/.env.local
```

Edit `frontend/.env.local`:

```env
NEXT_PUBLIC_PRIVY_APP_ID=your-privy-app-id
NEXT_PUBLIC_GOODDOLLAR_ENV=production
NEXT_PUBLIC_AJO_FACTORY_ADDRESS=0x5d872B5fe7334577d15Acbd7E62Dd954930eC85D
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0xE869345337E1cec4A84De62dA356259C262CB3B5
NEXT_PUBLIC_G_DOLLAR_ADDRESS=0x62B8B11039FcfE5aB0C56E502b1C372A3d2a9c7A```

To get a Privy App ID, create a project at [privy.io](https://privy.io).

### 3. Run tests

```bash
# Contract tests
npm run test:contracts

# Frontend type-check & lint
npm run type-check
npm run lint
```

### 4. Deploy contracts (Mainnet)

```bash
# Export your deployer private key (never commit this)
export PRIVATE_KEY=0x...

# Optional: Celoscan API key for contract verification
export CELOSCAN_API_KEY=...

npm run deploy:mainnet
```

Copy the printed contract address into `frontend/.env.local`.

### 5. Start the frontend

```bash
npm run dev
# → http://localhost:3000
```

---

## How Ajo Works

1. **Create** – A user creates a circle, choosing the G$ contribution amount, maximum members, and round duration.
2. **Join** – Other users join the open circle (up to `maxMembers`).
3. **Start** – The creator starts the circle once at least 2 members have joined.
4. **Contribute** – Each round every member calls `contribute()`, transferring their G$ to the contract.
5. **Payout** – Once all members have contributed, the full pot is automatically sent to the round's recipient (rotating in join order).
6. **Complete** – After `N` rounds (one per member) the circle is marked complete.

---

## Contract ABIs

Deployed ABIs live in `contracts/out/AjoCircle.sol/AjoCircle.json` after `forge build`. The frontend imports a typed ABI from `frontend/src/lib/contracts.ts`.

---

## Contributing

1. Fork and create a branch off `main`.
2. Run `forge fmt` before committing contract changes.
3. CI must pass (`forge test` + `next build`) before merging.
