# Ajo Circle

A decentralised rotating savings circle (ROSCA) built on **Celo Alfajores**, denominated in **G$ (GoodDollar)** tokens. Members pool contributions each round; the full pot rotates to one member per round until every member has received a payout.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Smart contracts | [Foundry](https://book.getfoundry.sh/) · Solidity ^0.8.20 · OpenZeppelin v5 |
| Frontend | [Next.js 14](https://nextjs.org/) (App Router) · TypeScript · Tailwind CSS |
| Wallet auth | [Privy](https://privy.io/) (email + embedded wallet fallback) |
| Chain interaction | [wagmi v2](https://wagmi.sh/) · [viem v2](https://viem.sh/) |
| Chain | Celo Alfajores testnet (chainId **44787**) |

---

## Repository Layout

```
ajo-circle/
├── contracts/             # Foundry project
│   ├── src/
│   │   └── AjoCircle.sol  # Core ROSCA contract
│   ├── test/
│   │   └── AjoCircle.t.sol
│   ├── script/
│   │   └── Deploy.s.sol
│   └── foundry.toml
├── frontend/              # Next.js 14 app
│   ├── src/
│   │   ├── app/           # App Router pages & layouts
│   │   ├── components/    # React components
│   │   └── lib/           # wagmi config, contract ABIs
│   └── package.json
├── .github/
│   └── workflows/
│       └── ci.yml         # forge test + next build on every PR
└── package.json           # npm workspaces root
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
NEXT_PUBLIC_GOODDOLLAR_ENV=staging
NEXT_PUBLIC_AJO_FACTORY_ADDRESS=0x...deployed-contract-address
NEXT_PUBLIC_YIELD_VAULT_ADDRESS=0x...yield-vault-address
NEXT_PUBLIC_G_DOLLAR_ADDRESS=0x...g-dollar-token-address
```

To get a Privy App ID, create a project at [privy.io](https://privy.io).

### 3. Run tests

```bash
# Contract tests
npm run test:contracts

# Frontend type-check & lint
npm run type-check
npm run lint
```

### 4. Deploy contracts (Alfajores)

```bash
# Export your deployer private key (never commit this)
export PRIVATE_KEY=0x...

# Optional: Celoscan API key for contract verification
export CELOSCAN_API_KEY=...

npm run deploy:alfajores
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
