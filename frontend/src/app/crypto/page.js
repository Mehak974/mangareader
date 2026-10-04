/**
 * /crypto — reference material on blockchain tech: how networks reach
 * agreement, why fees move, how to hold crypto, how to not lose it, and a
 * glossary of the vocabulary.
 *
 * Intentionally absent from src/app/sitemap.ts, so it stays out of the
 * submitted URL set. The route itself renders normally and is not blocked in
 * robots.ts.
 *
 * The popunder (Hilltop / purple-text.com) is suppressed here via
 * EXCLUDED_PATHS in components/AdScriptLoader.tsx. The page still carries one
 * in-flow 300x250 unit (components/AAdsInline.jsx) below the intro, plus the
 * sticky 728x90 banner every other page has.
 *
 * Widgets live in ./CryptoTools.jsx: client-side, computed locally, nothing
 * leaves the browser. None of this is financial advice.
 */
import Link from "next/link";
import Footer from "@/components/Footer";
import JsonLd from "@/components/JsonLd";
import AAdsInline from "@/components/AAdsInline";
import { buildMetadata, breadcrumbSchema, faqSchema, SITE_URL } from "@/lib/seo";
import { MarketBoard, GrowthPlanner, HalvingCountdown } from "./CryptoTools";

export const metadata = buildMetadata({
  title: "Crypto Hub — Bitcoin, Ethereum & Blockchain Explained",
  description:
    "A plain-English crypto reference: live market snapshot, blockchain fundamentals, L1 vs L2 comparison, stablecoin and custody tables, wallet security checklist, a growth planner, and a 200-term glossary.",
  path: "/crypto",
});

const JUMP_LINKS = [
  { href: "#markets", label: "Markets" },
  { href: "#fundamentals", label: "Fundamentals" },
  { href: "#consensus", label: "Consensus" },
  { href: "#layer-2", label: "Layer 2" },
  { href: "#l1", label: "Layer 1" },
  { href: "#stablecoins", label: "Stablecoins" },
  { href: "#defi", label: "DeFi" },
  { href: "#wallets", label: "Wallets" },
  { href: "#security", label: "Security" },
  { href: "#tools", label: "Tools" },
  { href: "#halving", label: "Halving" },
  { href: "#tax", label: "Tax" },
  { href: "#glossary", label: "Glossary" },
  { href: "#faq", label: "FAQ" },
];

const L1_NETWORKS = [
  {
    name: "Bitcoin",
    asset: "BTC",
    consensus: "Proof of Work",
    finality: "Probabilistic (~1 hour for a deep confirmation)",
    fee: "Often near zero, spikes at peak demand",
    note: "Hard-capped 21M supply, halving every 210,000 blocks, no smart contracts at L1.",
  },
  {
    name: "Ethereum",
    asset: "ETH",
    consensus: "Proof of Stake since the 2022 Merge",
    finality: "Economic, finalized in ~2 epochs (~13 min)",
    fee: "Burned base fee plus priority tip (EIP-1559)",
    note: "General-purpose smart-contract layer, and the base settlement for most major rollups.",
  },
  {
    name: "Solana",
    asset: "SOL",
    consensus: "Proof of Stake + Proof of History",
    finality: "Fast deterministic finality, sub-second typical",
    fee: "Tiny base fee plus an optional priority fee",
    note: "High throughput from parallel execution; a long record of outages under heavy load.",
  },
  {
    name: "BNB Chain",
    asset: "BNB",
    consensus: "Proof of Authority validator set",
    finality: "Fast block finality",
    fee: "Very low, fixed-gas model",
    note: "Large retail user base, EVM-compatible, centralised validator set.",
  },
  {
    name: "Cardano",
    asset: "ADA",
    consensus: "Proof of Stake (Ouroboros)",
    finality: "Slot-based deterministic finality",
    fee: "Low, with protocol-level minimums",
    note: "Peer-reviewed development process and an extended UTXO accounting model.",
  },
  {
    name: "Avalanche",
    asset: "AVAX",
    consensus: "Proof of Stake with subnets",
    finality: "Fast finality per subnet",
    fee: "Low, adjustable",
    note: "Subnets let institutions run permissioned chains with their own compliance rules.",
  },
  {
    name: "Polkadot",
    asset: "DOT",
    consensus: "Nominated Proof of Stake",
    finality: "Grandpa / BABE hybrid finality",
    fee: "Low, shared security model",
    note: "Parachains borrow the relay chain's security for their own use cases.",
  },
  {
    name: "Cosmos",
    asset: "ATOM",
    consensus: "Tendermint-style Proof of Stake",
    finality: "~6 seconds typical",
    fee: "Varies by chain",
    note: "The interchain protocol (IBC) is the real product here, not the base chain.",
  },
];

const L2_SYSTEMS = [
  {
    name: "Optimistic rollups (Arbitrum, Optimism, Base)",
    type: "Optimistic",
    settlement: "Posts compressed data to Ethereum",
    gas: "Paid in ETH on L1",
    trade: "Assume fraud proofs for ~7 days, so withdrawals lag. Cheap, and EVM-native.",
  },
  {
    name: "ZK rollups (zkSync, Starknet, Polygon zkEVM)",
    type: "Validity / zero-knowledge",
    settlement: "Posts a cryptographic proof to Ethereum",
    gas: "Paid in ETH on L1",
    trade: "Proves correctness on-chain, so withdrawals are near-instant. Heavier proving cost.",
  },
  {
    name: "Polygon PoS",
    type: "Sidechain",
    settlement: "Its own validator set, its own security",
    gas: "Paid in POL",
    trade: "Cheap and EVM-compatible, but not secured by Ethereum validators.",
  },
  {
    name: "Appchains (Cosmos SDK, Substrate, Avalanche subnets)",
    type: "App-specific chain",
    settlement: "Own or shared security model",
    gas: "Own native token",
    trade: "Full customisation, at the cost of running infrastructure and inheriting its risks.",
  },
  {
    name: "State channels / payment channels",
    type: "Off-chain channel",
    settlement: "Only the final state touches the chain",
    gas: "Paid on funding and settlement",
    trade: "Cheapest per transaction, but every participant has to be online and pre-funded.",
  },
  {
    name: "Account abstraction (ERC-4337)",
    type: "Smart-contract wallets",
    settlement: "Bundled transactions posted by paymasters",
    gas: "Often sponsored, or gasless",
    trade: "Users get passkeys and smart accounts without ever holding ETH.",
  },
];

const STABLECOINS = [
  {
    asset: "USDT",
    kind: "Fiat-collateralised, centralised issuer (Tether)",
    peg: "Cash, T-bills and equivalents. Periodic attestations, no public monthly proof",
    use: "Deepest liquidity, most exchanges, most off-chain settlement",
    risk: "The issuer and its banking counterparties. Attestations lag reality.",
  },
  {
    asset: "USDC",
    kind: "Fiat-collateralised, regulated issuer (Circle)",
    peg: "Cash and short-dated Treasuries, with regular reserves reporting",
    use: "Default choice on regulated venues and payment rails",
    risk: "Issuer, banking access, and a reserve mix that can shift with policy.",
  },
  {
    asset: "DAI",
    kind: "Crypto-collateralised over-collateralised CDP",
    peg: "Locked crypto collateral plus a stability module and RWA backing",
    use: "DeFi-native collateral and lending",
    risk: "Liquidation cascades, governance capture, slow crisis response.",
  },
  {
    asset: "USDe",
    kind: "Synthetic / delta-neutral, part crypto-backed",
    peg: "Hedged futures positions against exchange and counterparty exposure",
    use: "Yield-bearing stablecoin",
    risk: "Basis and funding-rate dependence, centralised hedging venues.",
  },
  {
    asset: "PYUSD, FDUSD, FRAX and similar",
    kind: "Mixed models, mostly fiat-collateralised",
    peg: "Varies by issuer; some are partly algorithmic",
    use: "Regional and DeFi liquidity",
    risk: "Smaller float, thinner books, wider spreads on the way out.",
  },
];

const CUSTODY_MODELS = [
  {
    model: "Exchange / custodial account",
    keys: "The exchange holds them, you hold an IOU",
    recovery: "Reset via email, phone, and KYC identity",
    fits: "Active traders who want fast settlement",
    risk: "One operator freeze or insolvency wipes out the balance. Not your keys, not your coins.",
  },
  {
    model: "Hosted self-custody wallet",
    keys: "You hold the key, the vendor holds a backup",
    recovery: "Vendor account plus a multi-party key share",
    fits: "Most long-term holders",
    risk: "Vendor outages and key-share failures. The key is still yours to lose.",
  },
  {
    model: "Self-custody software wallet",
    keys: "Only you, on your own device",
    recovery: "The 12/24-word seed phrase, and nothing else",
    fits: "Users comfortable taking backups seriously",
    risk: "Lost seed, clipboard malware, a mistyped address. There is no support line.",
  },
  {
    model: "Hardware wallet",
    keys: "Isolated in a secure element, signed on-device",
    recovery: "Seed phrase, ideally engraved or split in two",
    fits: "Long-term holdings of real size",
    risk: "Supply-chain attacks, unverified firmware, and a seed phrase that is still the secret.",
  },
  {
    model: "Multisig vault",
    keys: "Split across multiple signers and devices",
    recovery: "Needs M-of-N signers, e.g. 3 of 5",
    fits: "DAOs, treasuries, family offices",
    risk: "Signer collusion, key loss, coordination overhead. Never let one person hold enough to spend alone.",
  },
];

const GLOSSARY = [
  { term: "Address", def: "The public, derived identifier for an account. Safe to share, useless for spending without a matching private key." },
  { term: "Airdrop", def: "Free tokens pushed to an address, usually to seed a new network. Nearly all of them are scam entry points: connecting the wallet to claim is the actual payload." },
  { term: "AMM", def: "Automated market maker. A contract that prices trades against a pool of assets using a formula such as x·y=k instead of an order book." },
  { term: "APY / APR", def: "Annualised yield with and without compounding. Both are extrapolations from recent rates, and neither survives a bad month." },
  { term: "Atomicity", def: "All-or-nothing execution. Either every step of a transaction lands or none of it does, which is why a failed trade reverts instead of half-settling." },
  { term: "Block", def: "A batch of transactions published at a fixed interval. Bitcoin targets one every 10 minutes; faster chains target sub-second slots." },
  { term: "Block subsidy", def: "The newly minted coins awarded to whoever produces the block. It halves on a fixed schedule and eventually approaches zero, at which point fees have to fund security." },
  { term: "Bridge", def: "A service that locks assets on one chain and mints a wrapped equivalent on another. The most consistently exploited component in crypto." },
  { term: "Bull / bear market", def: "A sustained run of rising versus falling prices. Useful labels, terrible timing tools." },
  { term: "Cold wallet", def: "Keys generated and stored entirely offline. Immune to remote compromise, and correspondingly bad at convenience." },
  { term: "Custody", def: "Who can move the funds: you, a custodian, a smart contract, or a DAO. Every other risk follows from that one answer." },
  { term: "DAO", def: "Decentralised autonomous organisation: rules encoded as contracts plus token-holder governance. Governance is a voting market, not a parliament." },
  { term: "Decentralisation", def: "How many parties can censor, validate, or reverse an action. A spectrum with degrees, not a yes/no switch." },
  { term: "DeFi", def: "Decentralised finance: lending, trading, and derivatives rebuilt as open contracts rather than brokerage accounts." },
  { term: "Deterministic finality", def: "Once a block is final, no fork can ever reverse it. The property that lets a chain confirm a payment in under a second." },
  { term: "DCA", def: "Dollar-cost averaging: buying a fixed amount on a fixed schedule whatever the price. It averages out your entry points at the cost of timing cash flow." },
  { term: "Decentralised exchange (DEX)", def: "Trading directly against contract liquidity. No custody of your funds, and no support line when the contract is wrong." },
  { term: "EIP-1559", def: "Ethereum's 2021 fee overhaul: a burned base fee that tracks demand plus an optional priority tip. Gas stopped being a guess." },
  { term: "Epoch", def: "A fixed window of blocks after which rewards are paid out. Ethereum epochs are 32 slots, about six and a half minutes." },
  { term: "ERC-20", def: "The Ethereum token standard that made the ecosystem composable: any contract can handle any ERC-20 with no custom integration." },
  { term: "ERC-721 / ERC-1155", def: "Standards for non-fungible and semi-fungible tokens. Both are poorly served by their own tooling, which is why so much NFT activity moved to compressed formats on L2s." },
  { term: "Finality", def: "The guarantee that a transaction will not be reversed. The most important property when deciding what a chain is good for." },
  { term: "Fork", def: "A split in the rules. Soft forks are backwards-compatible upgrades; hard forks require every node to upgrade or the chain splits in two." },
  { term: "Gas", def: "The abstract unit of computation a chain prices work in. Cheap operations cost a fixed amount; storage and computation cost variable amounts." },
  { term: "Genesis block", def: "The first block of a chain, which encodes its initial state. Its hash often becomes the chain's identity — Bitcoin's begins 000000000019d668." },
  { term: "Gwei", def: "One-billionth of an ETH. Ethereum gas is quoted in gwei, so 20 gwei is 0.00000002 ETH." },
  { term: "Halving", def: "The scheduled halving of the block subsidy, every 210,000 blocks on Bitcoin, or roughly four years apart." },
  { term: "Hard fork", def: "A backwards-incompatible protocol change. The 2016 DAO fork split Ethereum into ETH and ETC permanently." },
  { term: "Hash / hashing", def: "A one-way fingerprint. Mining is a search for a hash below a target: enormous work, trivial verification, deliberately not random." },
  { term: "Hot wallet", def: "A wallet with its keys online, and therefore reachable by malware or a hostile site. Convenient, and the biggest single loss vector." },
  { term: "Impermanent loss", def: "The gap between holding a pool's assets and providing liquidity to it. Called impermanent because the loss only realises when you exit." },
  { term: "Layer 1", def: "A base blockchain that settles its own transactions: Bitcoin, Ethereum, Solana. The security floor everything else inherits or opts out of." },
  { term: "Layer 2", def: "A system that executes transactions off the base chain and posts data or proofs back to it: rollups, sidechains, channels, appchains." },
  { term: "Ledger", def: "The append-only record of state. Immutability is a design goal and a genuine trade-off — there is no admin delete button." },
  { term: "Light node / full node", def: "A light node trusts headers and skips old data; a full node stores and validates everything. Full nodes are what make a network decentralised." },
  { term: "Liquid staking", def: "Staking tokenised so it stays tradeable while it earns, usually via an exchange-issued receipt. Yield with added counterparty risk." },
  { term: "MEV", def: "Maximal extractable value: what block builders and searchers pull out by reordering, inserting or censoring transactions. Front-running and sandwich attacks are MEV." },
  { term: "Mempool", def: "The pending transaction pool. Public by default, which is precisely how front-running works, and why some chains encrypt or delay it." },
  { term: "Mining", def: "Proof-of-Work block production. Validators instead lock stake under Proof of Stake, and get slashed for cheating." },
  { term: "Multisig", def: "A contract or script requiring multiple keys to authorise a spend. The standard institutional custody pattern." },
  { term: "Node", def: "Software that validates and relays transactions. Run one and you check the chain yourself instead of trusting someone else's answer." },
  { term: "Nonce", def: "A per-transaction number preventing replay in account-based chains. In Ethereum, a stuck low nonce can block your own later transactions." },
  { term: "Oracle", def: "A service that feeds off-chain data like prices onto a chain. A single compromised oracle has caused some of the largest DeFi losses." },
  { term: "Proof of Stake", def: "Consensus secured by locked capital. Far cheaper and faster than Proof of Work, with its own risk profile: nothing at stake if you run it all on one exchange." },
  { term: "Proof of Work", def: "Consensus secured by burned electricity. The most expensive attack in the world to mount, which is the point." },
  { term: "Private key", def: "The secret that signs transactions. Whoever holds it controls the funds. No recovery, no reset, no support desk." },
  { term: "Rollover risk", def: "A short-dated note that matures into something riskier, quietly turning a fixed return into a variable one. Read the maturity, not the headline rate." },
  { term: "Rollup", def: "An L2 that batches transactions and posts compressed data or a validity proof to L1, inheriting its security." },
  { term: "Rug pull", def: "A project that abandons its code, drains pooled liquidity, or redeploys a honeypot contract. Unrecoverable, and the most common exit." },
  { term: "Seed phrase", def: "A 12 or 24-word BIP-39 encoding of a master key. It is the wallet. Anyone who has the words owns the coins, and no legitimate service will ever ask for them." },
  { term: "Slashing", def: "Confiscating part of a validator's stake as punishment for equivocation or downtime. The enforcement that makes Proof of Stake credible." },
  { term: "Smart contract", def: "Deployed code that runs automatically and cannot be amended once live. Powerful precisely because nobody can quietly change it, and dangerous for the same reason." },
  { term: "Stablecoin", def: "A token built to track a fiat currency, usually the dollar. The settlement layer of crypto markets, and the most depended-upon contract in the ecosystem." },
  { term: "Staking", def: "Locking the native token to secure the network and earn rewards. Rewards vary with total stake, and validators can be slashed." },
  { term: "Tokenisation", def: "Representing an asset or claim on-chain so it can be issued, split and transferred with settlement built in. The real institutional use case." },
  { term: "TPS", def: "Transactions per second. Real throughput always lands below the benchmark because nodes also handle blocks, reorgs and state growth." },
  { term: "Transaction fee", def: "What a user pays for inclusion: a base fee that adjusts to demand plus a tip. Fees are how scarce blockspace gets priced." },
  { term: "TVL", def: "Total value locked: assets sitting in protocols. A rough activity measure, inflated by looping the same collateral and by deposits that earn nothing." },
  { term: "Validator", def: "A node that stakes capital to take part in consensus and earn rewards." },
  { term: "Vitalik's trilemma", def: "A chain can optimise for at most two of decentralisation, security and scalability. Every architecture choice is a point in that triangle." },
  { term: "Wallet", def: "Software that manages keys and builds transactions. It usually holds no coins at all, only the authority to spend them." },
  { term: "Wash trading", def: "Trading with yourself to manufacture volume. Most headline volume figures on thin tokens are partly or entirely this." },
  { term: "Web3", def: "Applications running on a public blockchain where users hold their own data and identity, rather than sitting in a company's database." },
  { term: "Wrapped token", def: "A claim issued by a bridge or custodian for an asset held on another chain. Trust in the wrapper is trust in the issuer." },
  { term: "Yield farming", def: "Deploying assets into protocols for rewards, usually paid in more tokens. Emissions-based rewards are inflationary, and they end." },
  { term: "51% attack", def: "Controlling a majority of Proof-of-Work hashrate, enabling double spends and censorship. Expensive to rent, and exchanges have been hit by it." },
  { term: "Zero-knowledge proof", def: "A proof that you know something is true without revealing the underlying data. Powers privacy coins and validity rollups." },
];

const SECURITY_CHECKLIST = [
  { title: "Write the seed phrase on paper, offline", body: "Never type it into a website, never photograph it, never leave it in a cloud note or a screenshot. Metal survives fire and flooding better than paper, and you should test that you can actually restore from it before the day you need to." },
  { title: "Assume every 'support' DM is a scam", body: "No legitimate exchange, wallet, or protocol will ever ask for a seed phrase, a private key, or remote access to your machine. Neither will we. Ever." },
  { title: "Use a hardware wallet for anything you would miss", body: "Hold long-term balances on a device whose keys never touch a networked computer. The software wallet should be holding spending money and nothing else." },
  { title: "Check every address, every time", body: "Malware swaps out pasted addresses for ones it controls. Before you sign, compare the first and last six characters of the destination against the sending screen." },
  { title: "Revoke contract approvals periodically", body: "Revoking an approval stops a contract that later turns out to be compromised from draining your tokens. Treat unlimited approvals as a live risk, not a formality." },
  { title: "Use passkeys or an authenticator app, not SMS", body: "SIM swaps defeat SMS codes. Passkeys and TOTP apps do not care who controls your phone number." },
  { title: "Check the domain, twice", body: "Every major exchange has typosquat clones registered continuously. Bookmark the real site instead of typing the name." },
  { title: "Be slow with tokens you did not buy", body: "Somebody sending you an asset you never purchased is tracking you, not giving you anything. Do not click it, do not wrap it, do not bridge it, do not sell it." },
  { title: "Split operating and long-term holdings", body: "Keep a separate account for active trading, so a mistake only costs what you were already willing to lose." },
  { title: "Test the restore path with a small amount", body: "Move a small balance onto a new device from a new seed to prove the backup works. Finding out your seed does not work during a real emergency is the worst possible time to find out." },
];

const RED_FLAGS = [
  "Guaranteed or near-guaranteed returns. If somebody can promise you a floor, they are lying or running a Ponzi scheme. There is no third option.",
  "A countdown timer, an expiring allocation, 'spots are almost gone'. The scarcity is manufactured, and its only job is to stop you thinking.",
  "Recruitment into a downline or a team. That is a referral fee wearing a crypto costume.",
  "Unaudited contracts, an anonymous team, and a whitepaper that is really a token pitch.",
  "Liquidity that cannot be removed, or a contract you have not read the source of before signing.",
  "A token whose only purpose is buying access to the 'real' token.",
  "Anyone explaining how to get around a platform's security, or offering a 'test' withdrawal once you have deposited properly.",
  "A name, ticker or logo lifted from an established project. It is the oldest trick in crypto and it still works.",
];

const FAQS = [
  {
    question: "What is a blockchain, in plain English?",
    answer:
      "A blockchain is a shared append-only ledger that thousands of independent computers agree on and each keep a copy of. Every block bundles transactions plus a cryptographic link to the one before it, so altering history would mean rewriting every block after it on every computer. The security comes from that redundancy, not from any one company.",
  },
  {
    question: "What is the difference between Bitcoin and a cryptocurrency?",
    answer:
      "Bitcoin is one specific cryptocurrency: the first working blockchain network, launched in 2009, with a hard cap of 21 million coins and no central issuer. A cryptocurrency is the category — any digital asset built on cryptography and distributed ledgers to work as money or a store of value. Ethereum, Solana and thousands of others are cryptocurrencies. Bitcoin is the original one.",
  },
  {
    question: "How do I actually store crypto safely?",
    answer:
      "The rule is that a wallet does not hold the coins, it holds the key that moves them. For long-term balances, generate keys on a hardware wallet, write the 12 or 24-word recovery phrase on paper, and keep it somewhere physically separate. Leave only small spending amounts online. For active trading, a hosted or exchange account is fine, as long as you accept that the operator holds the assets, not you.",
  },
  {
    question: "What is a gas fee and why does it change?",
    answer:
      "Every network has limited block space, and gas is the abstract unit of computation it prices work in. Ethereum's EIP-1559 splits the fee into a burned base fee that rises automatically as blocks fill up, plus an optional priority tip. Fees spike when blocks are full and collapse when they are not, which is why the same transaction can cost cents at 3am and dollars during a frenzy.",
  },
  {
    question: "What is the blockchain halving?",
    answer:
      "It is a programmed cut to the reward paid for producing a block, built into Bitcoin's protocol. The subsidy halves every 210,000 blocks, roughly every four years: 50 BTC down to 25, then 12.5, then 6.25. New issuance keeps shrinking on schedule regardless of what price does, and that fixed, knowable supply schedule is the entire design.",
  },
  {
    question: "What is the difference between Layer 1 and Layer 2?",
    answer:
      "A Layer 1 is a base blockchain that settles its own transactions: Bitcoin, Ethereum, Solana. Layer 2 systems execute transactions somewhere cheaper or faster, then post the data or a cryptographic proof back to a Layer 1 for settlement. Rollups inherit the base chain's security. Sidechains run their own validators, and with them their own trust assumptions.",
  },
  {
    question: "What are stablecoins and why do they matter?",
    answer:
      "A stablecoin is a token built to track a fiat currency, usually the US dollar. They matter because crypto markets need something to be denominated in that does not swing 40 percent overnight. Most trading, lending and settlement happens in stablecoins, which quietly makes their issuers, reserves and banking relationships critical infrastructure for the whole ecosystem.",
  },
  {
    question: "Is cryptocurrency taxable?",
    answer:
      "In most countries yes, and the treatment varies. In the United States the IRS has classified digital assets as property since 2014, so every disposal is a capital transaction, and the cost-basis method you pick — FIFO, LIFO or specific identification — changes what you owe. Staking rewards, airdrops, spending crypto and swapping between tokens are all potentially taxable. Rules change often, so this is a pointer to professional advice rather than advice itself.",
  },
  {
    question: "What is a rug pull and how do I spot one?",
    answer:
      "A rug pull is an exit scam: the team launches a token, attracts liquidity, then drains the pool, abandons the contract, or leaves behind a honeypot that only sells back to them. Warning signs are an anonymous team, locked or unremovable liquidity, no audit, extreme promised returns, and code you have not read. No amount of chart analysis protects you from a contract whose only function is taking your money.",
  },
  {
    question: "What is impermanent loss?",
    answer:
      "When you provide liquidity to an automated market maker, your share of the pool drifts toward a 50/50 mix. If one asset rallies hard, you end up holding more of the loser and less of the winner than if you had just kept it. That gap is impermanent loss, and the name is the only hopeful part: it only becomes a realised loss when you withdraw, and the fees sometimes cover it.",
  },
  {
    question: "How does a wallet address work, and what is a seed phrase?",
    answer:
      "A wallet generates a large random private key, derives a public key from it, and hashes that into a short address such as 0x7a2f...41b9. The 12 or 24-word seed phrase is a human-readable encoding of the master key that every key in the wallet is derived from. Anyone holding the phrase controls every account derived from it, which is why the phrase is the only thing genuinely worth protecting.",
  },
  {
    question: "Can I still lose crypto if I do everything right?",
    answer:
      "Yes, to your own mistake, and to a well-funded adversary. Remote compromise of a clean hardware wallet is rare. The practical loss paths are a leaked seed phrase, a compromised software wallet, a malicious contract you signed, a fraudulent exchange, or a bridge. None of the mitigations are clever: offline backups, hardware keys, small balances online, and refusing unsolicited help.",
  },
];

export default function CryptoPage() {
  return (
    <>
      <JsonLd
        data={breadcrumbSchema([
          { name: "Home", url: SITE_URL },
          { name: "Crypto", url: `${SITE_URL}/crypto` },
        ])}
      />
      <JsonLd data={faqSchema(FAQS)} />

      <div className="legal-page crypto-page">
        <div className="legal-container">
          <div className="crypto-badge">Reference · not financial advice</div>
          <h1>Crypto, Explained Properly</h1>
          <p className="legal-subtitle">
            How blockchains work, why transaction fees spike, how to hold crypto without losing it,
            and a glossary of the terms you will run into. Reference material — not financial advice.
          </p>

          <nav className="crypto-jump" aria-label="Sections on this page">
            {JUMP_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>

          {/* ── WARNING ─────────────────────────────────────────────── */}
          <div className="crypto-warn">
            <strong>Read this first.</strong> Most crypto assets can drop 80 or 90 percent without
            warning, and most tokens never come back. Add impersonation to that, and you are in the
            least trustworthy corner of the financial internet. Nothing here recommends buying or
            selling anything. It is an explanation of how the plumbing works, so that you can tell
            when somebody is making things up.
          </div>

          {/* ── AD ─────────────────────────────────────────────────── */}
          {/* One 300x250 slot, after the intro and before the first section.
              Placed here rather than at the foot of a 15-section reference
              page because this is the only ad the page will ever serve: below
              the fold it would go unseen for most visitors. In flow, like every
              other unit on the site — nothing floats over the text. */}
          <AAdsInline />

          {/* ── MARKETS ─────────────────────────────────────────────── */}
          <section id="markets">
            <h2>Market Snapshot</h2>
            <p>
              Prices never sit still, so a hardcoded number on a web page is wrong within minutes.
              This table pulls live data in your browser and refreshes every 60 seconds. If the feed
              is down it shows blanks rather than a figure it cannot stand behind.
            </p>
            <MarketBoard />
          </section>

          {/* ── FUNDAMENTALS ────────────────────────────────────────── */}
          <section id="fundamentals">
            <h2>What A Blockchain Actually Is</h2>
            <p>
              A blockchain is a chain of blocks. Each one holds a batch of transactions plus a
              cryptographic fingerprint of the block before it, and every participant keeps a full
              copy and re-checks the rules themselves. To alter something already recorded, you
              would have to redo every block after it on every computer in the network. That is what
              makes the record tamper-evident rather than merely claimed to be.
            </p>
            <p>
              Three properties do the heavy lifting. Settled transactions cannot be quietly
              reversed. Every transaction is public and stays public forever, which is excellent for
              auditors and terrible for anyone who needs privacy. And nobody can block your
              transaction, as long as you can pay the fee.
            </p>
            <p>
              All three cost something. The guarantees exist because checking the rules is expensive
              and somebody gets paid to do it, whether that is a miner or a validator. That payment
              is the security budget. On a mature chain, fees have to cover it, and what happens when
              they do not is still an open question.
            </p>
          </section>

          {/* ── CONSENSUS ───────────────────────────────────────────── */}
          <section id="consensus">
            <h2>How Networks Reach Agreement</h2>
            <p>
              Consensus is the rule for deciding which copy of the ledger is the real one. Two
              approaches dominate, and they pay for security in entirely different currencies.
            </p>
            <div className="crypto-two-col">
              <div className="crypto-card">
                <h3>Proof of Work</h3>
                <p>
                  Miners burn electricity racing to produce a valid block, and the majority chain is
                  the real one. Out-spending the network is the attack. Bitcoin uses it. About 98
                  percent of mining capacity sits in a handful of pools, but running a pool is not
                  the same as owning the hashrate, and pools cannot redirect your transaction.
                </p>
                <p>
                  The failure mode is a 51% attack, which allows double-spending and censorship, not
                  theft of coins sitting still. Exchanges have been hit by it more than once. The
                  defence is cost, and mining burns power.
                </p>
              </div>
              <div className="crypto-card">
                <h3>Proof of Stake</h3>
                <p>
                  Validators lock capital and are randomly selected to propose blocks. Cheating
                  means losing part of that stake to slashing. Ethereum, Cardano, Solana and most
                  newer chains use it: far cheaper, much faster, and able to finalise in seconds
                  instead of hours.
                </p>
                <p>
                  The failure mode is concentration. If the stake sits custodied on two exchanges,
                  their outage is the chain&apos;s outage. The decentralisation is only as real as the
                  distribution of the stake.
                </p>
              </div>
            </div>
            <p>
              Ethereum&apos;s Merge in September 2022 moved it from Proof of Work to Proof of Stake
              and cut its energy use by about 99.95% in a single step. Restaking layers and
              alternative data-availability designs are the current attempts to get throughput
              without paying for it in security.
            </p>
          </section>

          {/* ── LAYER 2 ─────────────────────────────────────────────── */}
          <section id="layer-2">
            <h2>Layer 1 vs Layer 2 Scaling</h2>
            <p>
              Every blockchain ends up picking two of decentralisation, security and speed. That is
              the trilemma. Layer 2 is the general name for the attempts to get the third: run the
              transactions somewhere cheaper, then pay for the settlement on the base chain
              afterwards.
            </p>
            <div className="crypto-table-wrap">
              <table className="crypto-table">
                <thead>
                  <tr>
                    <th>System</th>
                    <th>Type</th>
                    <th>Settlement</th>
                    <th>Gas paid in</th>
                    <th>Trade-off</th>
                  </tr>
                </thead>
                <tbody>
                  {L2_SYSTEMS.map((row) => (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.type}</td>
                      <td>{row.settlement}</td>
                      <td>{row.gas}</td>
                      <td>{row.trade}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              A rollup runs transactions off-chain and posts the data, compressed, back to Layer 1.
              Optimistic rollups assume operators behave and leave a window to prove fraud. Zero
              knowledge rollups prove the arithmetic instead. And the word itself is not a crypto
              invention: batching transactions into one settlement is what card networks have
              always done.
            </p>
          </section>

          <section id="l1">
            <h2>Major Layer 1 Networks</h2>
            <p>
              The base layers below differ enormously in what they optimise for. Read the consensus
              and finality columns first. Every marketing claim about a chain follows from those
              two.
            </p>
            <div className="crypto-table-wrap">
              <table className="crypto-table">
                <thead>
                  <tr>
                    <th>Network</th>
                    <th>Native asset</th>
                    <th>Consensus</th>
                    <th>Finality</th>
                    <th>Typical fee</th>
                    <th>Design notes</th>
                  </tr>
                </thead>
                <tbody>
                  {L1_NETWORKS.map((row) => (
                    <tr key={row.name}>
                      <td><strong>{row.name}</strong></td>
                      <td>{row.asset}</td>
                      <td>{row.consensus}</td>
                      <td>{row.finality}</td>
                      <td>{row.fee}</td>
                      <td>{row.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ── STABLECOINS ─────────────────────────────────────────── */}
          <section id="stablecoins">
            <h2>Stablecoins and the Peg</h2>
            <p>
              A stablecoin is a token that aims to hold the value of a fiat currency. How it holds
              that value is the whole story, and where it holds it is where the risk sits.
              Dollar-backed tokens are only as solid as the reserves and the issuer&apos;s banking
              access. Crypto-collateralised ones get liquidated out. Algorithmic designs lean on
              arbitrage and have collapsed. Synthetics depend on whoever holds the other side of the
              hedge.
            </p>
            <div className="crypto-table-wrap">
              <table className="crypto-table">
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Model</th>
                    <th>How the peg holds</th>
                    <th>Typical use</th>
                    <th>Where the risk sits</th>
                  </tr>
                </thead>
                <tbody>
                  {STABLECOINS.map((row) => (
                    <tr key={row.asset}>
                      <td><strong>{row.asset}</strong></td>
                      <td>{row.kind}</td>
                      <td>{row.peg}</td>
                      <td>{row.use}</td>
                      <td>{row.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Watch the word &quot;audited&quot;. An attestation from an accounting firm is a snapshot
              taken on one day, not continuous proof, and a report published months ago tells you
              little about today. What matters is whether reserves are held one-for-one, and whether
              your balance is legally separated from the company&apos;s own money.
            </p>
          </section>

          {/* ── DEFI ────────────────────────────────────────────────── */}
          <section id="defi">
            <h2>Decentralised Finance Mechanics</h2>
            <p>
              DeFi swaps the broker out for a contract. Learn the four mechanics below and you can
              read most protocol documentation, audit reports, and postmortems you will ever come
              across.
            </p>
            <div className="crypto-two-col">
              <div className="crypto-card">
                <h3>Lending</h3>
                <p>
                  You post collateral worth more than you borrow and pay a variable rate. If the
                  collateral drops below the liquidation threshold, anyone can pay off part of your
                  debt and take the collateral at a discount. There is no credit risk and no way to
                  lose more than you posted, but a fast market drop sets off liquidations at exactly
                  the moment nobody wants to be selling.
                </p>
              </div>
              <div className="crypto-card">
                <h3>Automated market makers</h3>
                <p>
                  An AMM prices trades out of a pool instead of an order book. Under the standard
                  x·y=k formula the bigger the trade, the worse the price you get, so slippage
                  scales with size. Traders pay fees that accrue to liquidity providers, minus
                  whatever impermanent loss the pool caused them.
                </p>
              </div>
              <div className="crypto-card">
                <h3>Perpetual futures</h3>
                <p>
                  A contract that tracks the price of an asset without ever holding it. You post
                  margin, pay funding to stay near the index price, and get liquidated if the move
                  against you exceeds that margin. Fully on-chain versions drop the exchange
                  counterparty and pick up oracle risk instead.
                </p>
              </div>
              <div className="crypto-card">
                <h3>Staking and restaking</h3>
                <p>
                  Locking the chain&apos;s own token to help secure it earns a share of the rewards.
                  Restaking lets that same stake back several services at once. More services
                  secured means more yield, and more ways to get slashed. A higher number here is
                  not free money, it is a longer list of ways to lose everything.
                </p>
              </div>
            </div>
            <p>
              TVL, total value locked, is the number DeFi reports most often and it means close to
              nothing on its own. Deposit the same collateral in two protocols that each count it
              and it is counted twice. Lend it out, redeposit the loan, and the same dollar gets
              counted several times over. It measures activity, not safety.
            </p>
          </section>

          {/* ── WALLETS ─────────────────────────────────────────────── */}
          <section id="wallets">
            <h2>Wallets and Custody</h2>
            <p>
              The thing to understand first: a wallet does not hold coins. It holds the key that
              moves them. Everything below follows from who controls that key.
            </p>
            <div className="crypto-table-wrap">
              <table className="crypto-table">
                <thead>
                  <tr>
                    <th>Model</th>
                    <th>Who holds the keys</th>
                    <th>How you recover</th>
                    <th>Best for</th>
                    <th>Main risk</th>
                  </tr>
                </thead>
                <tbody>
                  {CUSTODY_MODELS.map((row) => (
                    <tr key={row.model}>
                      <td><strong>{row.model}</strong></td>
                      <td>{row.keys}</td>
                      <td>{row.recovery}</td>
                      <td>{row.fits}</td>
                      <td>{row.risk}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p>
              Hot and cold describe where the keys sit, not what the software is. Hot means the key
              lives on a device that is online, which is convenient and is exactly why hot wallets
              get drained. Cold means the key never touches the network and you sign on a device
              with no way to phone home. The usual setup is both at once: a small hot wallet for
              day-to-day spending, a hardware wallet for anything you are not actively using.
            </p>
          </section>

          {/* ── SECURITY ────────────────────────────────────────────── */}
          <section id="security">
            <h2>The Security Checklist</h2>
            <p>
              Almost every large loss traces back to one of a handful of mistakes, and none of them
              take any technical skill to avoid.
            </p>
            <ol className="crypto-steps">
              {SECURITY_CHECKLIST.map((item) => (
                <li key={item.title}>
                  <strong>{item.title}</strong>
                  <p>{item.body}</p>
                </li>
              ))}
            </ol>

            <h3>Red flags that should end the conversation</h3>
            <ul className="crypto-flags">
              {RED_FLAGS.map((flag) => (
                <li key={flag}>{flag}</li>
              ))}
            </ul>
            <p>
              One habit covers most of these: never connect a wallet to a site you reached from a
              direct message, a shortened link, or an advert. A wallet approval prompt is a
              financial transaction, so read it before you click it.
            </p>
          </section>

          {/* ── TOOLS ───────────────────────────────────────────────── */}
          <section id="tools">
            <h2>Tools</h2>
            <p>
              Both of these run in your browser on local arithmetic. Nothing is submitted, no wallet
              is connected, and nothing is stored. Read the output as arithmetic rather than as a
              prediction.
            </p>
            <GrowthPlanner />
          </section>

          {/* ── HALVING ─────────────────────────────────────────────── */}
          <section id="halving">
            <h2>Halvings, Issuance and Scarcity</h2>
            <HalvingCountdown />
            <p>
              The halving gets sold as a price catalyst. It is not a decision and never was. It is
              arithmetic written into the protocol in 2009, known to everyone years in advance. What
              it actually does is make the supply schedule knowable in advance, which is the one
              thing gold cannot offer, and shrink new issuance every four years until issuance stops
              being the story.
            </p>
            <p>
              Once the subsidy reaches its floor, security has to be funded by fees alone. Which
              chains can get there, and at what fee level, is still an open question.
            </p>
          </section>

          {/* ── TAX ─────────────────────────────────────────────────── */}
          <section id="tax">
            <h2>Tax and Reporting</h2>
            <p>
              Tax is the part most people get wrong, and underneath it is pure bookkeeping. The IRS
              has treated digital assets as property since 2014, which means spending, converting or
              trading crypto is a disposal that realises a gain or a loss. You can pick FIFO, LIFO or
              specific identification, but you have to stick with it, and if you trade at all you
              need to have kept the basis and the dates.
            </p>
            <p>
              Staking rewards, airdrops, hard-fork coins and getting paid in tokens are each treated
              differently depending on where you live, and the rules change often. Some countries tax
              staking or mining income the moment it lands. None of this is advice. It is a reason to
              find an accountant who already knows about digital assets now rather than during your
              first audit.
            </p>
          </section>

          {/* ── GLOSSARY ────────────────────────────────────────────── */}
          <section id="glossary">
            <h2>A–Z Glossary</h2>
            <p>{GLOSSARY.length} terms, explained without leaning on any of the others.</p>
            <div className="crypto-glossary">
              {GLOSSARY.map((entry) => (
                <div className="crypto-term" key={entry.term}>
                  <div className="crypto-term-head">{entry.term}</div>
                  <p>{entry.def}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── FAQ ─────────────────────────────────────────────────── */}
          <section id="faq">
            <h2>Frequently Asked Questions</h2>
            {FAQS.map((faq) => (
              <details className="crypto-faq" key={faq.question}>
                <summary>{faq.question}</summary>
                <p>{faq.answer}</p>
              </details>
            ))}
          </section>

          {/* ── CLOSING ─────────────────────────────────────────────── */}
          <section id="summary">
            <h2>The Short Version</h2>
            <ol className="crypto-steps">
              <li>
                <strong>Learn the mechanics before you look at the charts.</strong> A wallet, a key, a
                block, a fee. Get those straight and the rest follows on its own.
              </li>
              <li>
                <strong>Not your keys, not your coins.</strong> What sits on a platform can be frozen,
                seized or simply gone. Self-custody hands that risk back to you, and that is the trade
                you are making.
              </li>
              <li>
                <strong>Security is a routine, not a product.</strong> Hardware wallet, seed phrase on
                paper somewhere dry, passkey 2FA, and an afternoon every few months revoking approvals.
              </li>
              <li>
                <strong>Higher yield means higher risk. Every time.</strong> If nobody can tell you
                where a return comes from, it is being paid out of somebody else&apos;s capital, quite
                possibly yours.
              </li>
              <li>
                <strong>Size positions so a total loss would not change your life.</strong> That one
                rule does more for you than any amount of on-chain analysis.
              </li>
            </ol>

            <div className="crypto-warn crypto-warn-strong">
              <strong>Disclaimer.</strong> Educational reference material about blockchain
              technology. Nothing here is financial, investment, tax or legal advice, and nothing is
              an offer to buy or sell any digital asset. Crypto can go to zero, and several of the
              figures on this page are simplifications that may already be out of date. Do your own
              research and talk to a qualified professional before acting on any of it.
            </div>

            <p style={{ marginTop: "2rem" }}>
              Back to the <Link href="/">library</Link>, or read the <Link href="/faq">site FAQ</Link>.
            </p>
          </section>
        </div>
      </div>

      <Footer />
    </>
  );
}
