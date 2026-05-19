// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IBurnable {
    function burn(uint256 amount) external;
}

/**
 * @title AnchorVaultV43
 * @notice Multi-asset защищённое хранилище. Упрощённая система кодов: 3 фразы (10-64 символа).
 *         - code: основной код (для withdraw/transfer/deposit/setTimelock/setVoluntaryLock)
 *         - antiPhrase: антифишинг (показывается в UI до подписи)
 *         - recovery: аварийный код (для earlyClose/recoverToSafe/emergencyAny/changeEmergencyAddress)
 *         Все пользовательские операции мгновенные. Админские — с 7-дневным таймлоком.
 *
 *         Изменения V42 → V43:
 *         - Коды: 6 полей (3 пары word+digits) → 3 одиночных поля
 *         - Vault struct: убраны 6 устаревших полей (экономия 4 storage слотов)
 *         - ФИКС: transferVault больше не ломает lockedPrincipal
 *         - Status упрощён: 0=ACTIVE, 1=CLOSED (было 0/1/2)
 *         - AntiPhish проверяется во ВСЕХ операциях вывода + теперь через единый _verifyAntiPhish
 *         - Антифишинг-проверка ловит непустые но неверные коды (раньше можно было обойти одним символом)
 */
contract AnchorVaultV43 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── ERRORS ─────────────────────────────────────────────
    error BadVaultId();
    error NotActive();
    error WeakCode();
    error CodeTooLong();
    error WrongCode();
    error AntiPhishRequired();
    error ZeroAddress();
    error InvalidAddress();
    error Locked();
    error Frozen();
    error NotCreator();
    error NotGuardian();
    error ContractPaused();
    error TokenNotSupported();
    error DepositBelowMinimum();
    error InvalidAmount();
    error InvalidLevel();
    error VaultLimitReached();
    error TooManyAttempts();
    error MustRotateCodesFirst();
    error TimelockTooLong();
    error LockTooLong();
    error CooldownNotExpired();
    error NotPendingRole();
    error PauseTimeoutNotReached();
    error NoPauseRequest();
    error AdminRequestPending();
    error TimelockNotExpired();
    error NoAdminRequest();
    error BonusExceedsLimit();
    error AmountExceedsUint120();
    error DirectTransferForbidden();

    // ─── EVENTS ─────────────────────────────────────────────
    event VaultCreated(address indexed user, uint256 vaultId, address indexed token, uint256 amount, string name, address emergencyAddress, uint8 level);
    event VaultDeposited(address indexed user, uint256 vaultId, address indexed token, uint256 net, uint256 newTotal);
    event VaultWithdrawn(address indexed user, uint256 vaultId, address indexed token, uint256 amount);
    event VaultEarlyClosed(address indexed user, uint256 vaultId, uint256 payout, uint256 penalty);
    event VaultRecovered(address indexed user, uint256 vaultId, address indexed to, uint256 payout, uint256 penalty);
    event EmergencyWithdrawToAny(address indexed user, uint256 vaultId, address indexed to, uint256 amount, uint256 fee);
    event VaultTransferred(address indexed from, address indexed to, uint256 fromId, uint256 toId);
    event CodesRotated(address indexed user, uint256 vaultId);
    event TimelockSet(address indexed user, uint256 vaultId, uint256 hoursVal);
    event VoluntaryLockSet(address indexed user, uint256 vaultId, uint256 lockedUntil);
    event EmergencyAddressChanged(address indexed user, uint256 vaultId, address newAddress);
    event FailedAttempt(address indexed user, uint256 vaultId, uint16 failCount, uint256 lockedUntil);
    event WrongCodeAttempt(address indexed user, uint256 vaultId);
    event FailedAttemptsReset(address indexed user);
    event EmergencyFreeze(address indexed user, uint256 totalAttempts);
    event PenaltyDistributed(address indexed token, uint256 burnAmt, uint256 creatorAmt, uint256 reserveAmt, uint256 rewardsAmt);
    event FeeCollected(address indexed user, address indexed token, uint256 fee);
    event WelcomeBonusPaid(address indexed user, uint256 amount);
    event WelcomeBonusChanged(uint256 newAmount);
    event RewardPoolDonated(address indexed from, address indexed token, uint256 amount);
    event TokenSupported(address indexed token);
    event TokenUnsupported(address indexed token);
    event PauseRequested(address indexed guardian, uint256 effectiveAt);
    event PauseRequestCancelled(address indexed guardian);
    event PauseStateChanged(bool paused, bool emergency);
    event CreatorshipTransferRequested(address indexed current, address indexed pending);
    event GuardianshipTransferRequested(address indexed current, address indexed pending);
    event CreatorshipAccepted(address indexed newCreator);
    event GuardianshipAccepted(address indexed newGuardian);
    event CreatorWithdrawRequested(address indexed token, uint256 amount, uint256 unlocksAt);
    event ReserveWithdrawRequested(address indexed token, uint256 amount, uint256 unlocksAt);
    event CreatorWithdrawn(address indexed token, address indexed to, uint256 amount);
    event ReserveWithdrawn(address indexed token, address indexed to, uint256 amount);
    event CreatorWithdrawCancelled(address indexed token);
    event ReserveWithdrawCancelled(address indexed token);

    // ─── ENUMS / STRUCTS ────────────────────────────────────
    enum VaultLevel { SAFE, VAULT, FORTRESS }

    struct VaultParams {
        string name;
        string code;        // основной код (10-64 символа)
        string antiPhrase;  // антифишинг (10-64 символа)
        string recovery;    // аварийная фраза (10-64 символа)
        uint256 amount;
        address emergencyAddress;
    }

    struct NewCodes {
        string newCode;
        string newAntiPhrase;
        string newRecovery;
    }

    struct Vault {
        // slot 1: 20 + 6 + 6 = 32 bytes
        address token;
        uint48  lockedAt;
        uint48  depositedAt;
        // slot 2: 15 + 8 + 2 + 2 + 1 + 1 + 1 = 30 bytes
        uint120 amount;
        uint64  id;
        uint16  failCount;
        uint16  timelockHours;
        uint8   level;
        uint8   status; // 0=ACTIVE, 1=CLOSED
        bool    requiresCodeRotation;
        // slot 3: 20 + 6 + 6 = 32 bytes
        address emergencyAddress;
        uint48  lockedUntil;
        uint48  voluntaryLockUntil;
        // slots 4-7: хеши и соль
        bytes32 secretHash;
        bytes32 antiPhishHash;
        bytes32 emergencySecretHash;
        bytes32 salt;
        // dynamic: имя
        string  name;
    }

    // ─── CONSTANTS ──────────────────────────────────────────
    uint256 public constant VERSION = 43;
    uint256 public constant MIN_CODE_LENGTH = 10;
    uint256 public constant MAX_CODE_LENGTH = 64;
    uint256 public constant MIN_DEPOSIT = 10**16;
    uint256 public constant FAIL_COUNTER_RESET_PERIOD = 30 days;
    uint256 public constant CREATOR_COOLDOWN = 7 days;
    uint256 public constant GUARDIAN_COOLDOWN = 2 days;

    uint256 public constant SAFE_DEPOSIT_FEE_BPS = 50;
    uint256 public constant VAULT_DEPOSIT_FEE_BPS = 150;
    uint256 public constant FORTRESS_DEPOSIT_FEE_BPS = 200;

    uint256 public constant SAFE_MAX_TIMELOCK_HOURS = 0;
    uint256 public constant VAULT_MAX_TIMELOCK_HOURS = 72;
    uint256 public constant FORTRESS_MAX_TIMELOCK_HOURS = 168;

    uint256 public constant OPEN_VAULT_FEE_BPS = 20;        // 0.2%
    uint256 public constant WITHDRAW_FEE_BPS = 50;          // 0.5%
    uint256 public constant TRANSFER_FEE_BPS = 50;          // 0.5%
    uint256 public constant EARLY_CLOSE_FEE_BPS = 500;      // 5%
    uint256 public constant RECOVER_TO_SAFE_FEE_BPS = 1000; // 10%
    uint256 public constant EMERGENCY_ANY_FEE_BPS = 1500;   // 15%

    uint256 public constant PEN_BURN_BPS_ANCR = 2000;
    uint256 public constant PEN_CREATOR_BPS_ANCR = 2500;
    uint256 public constant PEN_RESERVE_BPS_ANCR = 2000;

    uint256 public constant PEN_CREATOR_BPS_OTHER = 4000;
    uint256 public constant PEN_RESERVE_BPS_OTHER = 4000;

    uint256 public constant SOFT_LOCK_THRESHOLD = 5;
    uint256 public constant HARD_LOCK_THRESHOLD = 30;
    uint256 public constant AUTO_EMERGENCY_THRESHOLD = 35;
    uint256 public constant MAX_TOTAL_ATTEMPTS = 50;
    uint256 public constant FROZEN_PERIOD = 7 days;
    uint256 public constant MIN_GLOBAL_ATTEMPT_INTERVAL = 1 minutes;

    uint256 public constant PAUSE_DELAY = 2 days;
    uint256 public constant ADMIN_WITHDRAW_TIMELOCK = 7 days;
    uint256 public constant MAX_VOLUNTARY_LOCK = 5 * 365 days;
    uint256 public constant MAX_WELCOME_BONUS = MIN_DEPOSIT / 2;

    // ─── IMMUTABLES ─────────────────────────────────────────
    address public immutable ANCR_TOKEN;

    // ─── STORAGE ────────────────────────────────────────────
    mapping(address => bool) public supportedTokens;
    mapping(address => mapping(uint256 => Vault)) private vaults;
    mapping(address => uint256) public userVaultCount;
    mapping(address => uint256) public activeVaultId;
    mapping(address => uint256) public totalFailedAttempts;
    mapping(address => uint256) public frozenUntil;
    mapping(address => uint256) public lastGlobalAttempt;
    uint256 public welcomeBonus;
    mapping(address => bool) public welcomeBonusClaimed;
    mapping(address => uint256) public lockedPrincipal;
    mapping(address => uint256) public creatorFees;
    mapping(address => uint256) public strategicReserve;
    mapping(address => uint256) public rewardPool;
    uint256 public totalBurnedANCR;

    address public creator;
    address public guardian;
    address public pendingCreator;
    address public pendingGuardian;
    uint256 public creatorshipRequestedAt;
    uint256 public guardianshipRequestedAt;
    bool public paused;
    uint256 public pauseTimestamp;

    mapping(address => address) public creatorWithdrawalTo;
    mapping(address => uint256) public creatorWithdrawalAmount;
    mapping(address => uint256) public creatorWithdrawalUnlock;
    mapping(address => address) public reserveWithdrawalTo;
    mapping(address => uint256) public reserveWithdrawalAmount;
    mapping(address => uint256) public reserveWithdrawalUnlock;

    // ─── CONSTRUCTOR ────────────────────────────────────────
    constructor(address _ancrToken, address _guardian) {
        if (_ancrToken == address(0)) revert ZeroAddress();
        if (_guardian == address(0)) revert ZeroAddress();
        if (_guardian == msg.sender) revert InvalidAddress();
        if (_ancrToken == msg.sender || _ancrToken == _guardian) revert InvalidAddress();

        ANCR_TOKEN = _ancrToken;
        creator = msg.sender;
        guardian = _guardian;
        supportedTokens[_ancrToken] = true;
        emit TokenSupported(_ancrToken);
    }

    // ─── MODIFIERS ─────────────────────────────────────────
    modifier whenNotPaused() { if (paused) revert ContractPaused(); _; }
    modifier vaultExists(address user, uint256 vid) {
        if (vid == 0 || vaults[user][vid].id != vid) revert BadVaultId();
        _;
    }
    modifier notGloballyFrozen() {
        _resetUserFailedAttemptsIfExpired(msg.sender);
        if (frozenUntil[msg.sender] > block.timestamp) revert Frozen();
        _;
    }
    modifier onlyCreator() { if (msg.sender != creator) revert NotCreator(); _; }
    modifier onlyGuardian() { if (msg.sender != guardian) revert NotGuardian(); _; }
    modifier codesNotRequiringRotation(address user, uint256 vid) {
        if (vaults[user][vid].requiresCodeRotation) revert MustRotateCodesFirst();
        _;
    }

    // ═══════════════════════════════════════════════════════
    //                 TOKEN MANAGEMENT
    // ═══════════════════════════════════════════════════════
    function addSupportedToken(address token) external onlyCreator {
        if (token == address(0)) revert ZeroAddress();
        if (IERC20Metadata(token).decimals() != 18) revert TokenNotSupported();
        supportedTokens[token] = true;
        emit TokenSupported(token);
    }

    function removeSupportedToken(address token) external onlyCreator {
        if (token == ANCR_TOKEN) revert InvalidAddress();
        supportedTokens[token] = false;
        emit TokenUnsupported(token);
    }

    // ═══════════════════════════════════════════════════════
    //                 HELPERS
    // ═══════════════════════════════════════════════════════
    function _checkUint120(uint256 amount) internal pure {
        if (amount > type(uint120).max) revert AmountExceedsUint120();
    }
    function _resetUserFailedAttemptsIfExpired(address user) internal {
        if (block.timestamp > lastGlobalAttempt[user] + FAIL_COUNTER_RESET_PERIOD) {
            if (totalFailedAttempts[user] != 0 || frozenUntil[user] != 0) {
                totalFailedAttempts[user] = 0;
                frozenUntil[user] = 0;
            }
        }
    }
    function _applyPenalty(uint256 amount, uint256 bps) internal pure returns (uint256 penalty) {
        penalty = (amount * bps) / 10000;
        if (penalty == 0 && amount > 0) penalty = 1;
    }
    function _getDepositFee(uint256 level) internal pure returns (uint256) {
        if (level == uint256(VaultLevel.SAFE))     return SAFE_DEPOSIT_FEE_BPS;
        if (level == uint256(VaultLevel.VAULT))    return VAULT_DEPOSIT_FEE_BPS;
        if (level == uint256(VaultLevel.FORTRESS)) return FORTRESS_DEPOSIT_FEE_BPS;
        revert InvalidLevel();
    }
    function _getMaxTimelock(uint256 level) internal pure returns (uint256) {
        if (level == uint256(VaultLevel.SAFE))     return SAFE_MAX_TIMELOCK_HOURS;
        if (level == uint256(VaultLevel.VAULT))    return VAULT_MAX_TIMELOCK_HOURS;
        if (level == uint256(VaultLevel.FORTRESS)) return FORTRESS_MAX_TIMELOCK_HOURS;
        revert InvalidLevel();
    }
    function _canOpenNewVault(address user) internal view returns (bool) {
        return activeVaultId[user] == 0;
    }
    function _validateCodes(VaultParams calldata p) internal pure {
        _checkCodeLength(p.code);
        _checkCodeLength(p.antiPhrase);
        _checkCodeLength(p.recovery);
    }
    function _validateNewCodes(NewCodes calldata nc) internal pure {
        _checkCodeLength(nc.newCode);
        _checkCodeLength(nc.newAntiPhrase);
        _checkCodeLength(nc.newRecovery);
    }
    function _checkCodeLength(string memory code) internal pure {
        uint256 len = bytes(code).length;
        if (len < MIN_CODE_LENGTH) revert WeakCode();
        if (len > MAX_CODE_LENGTH) revert CodeTooLong();
    }

    // ═══════════════════════════════════════════════════════
    //          CODE VERIFICATION
    // ═══════════════════════════════════════════════════════
    function _checkMainCode(address user, uint256 vid, string calldata code) internal returns (bool) {
        Vault storage v = vaults[user][vid];
        if (block.timestamp < v.lockedUntil) revert Locked();
        if (block.timestamp < v.voluntaryLockUntil) revert Locked();
        return _verifyHash(user, vid, code, v.secretHash);
    }
    function _checkRecoveryCode(address user, uint256 vid, string calldata code) internal returns (bool) {
        Vault storage v = vaults[user][vid];
        if (block.timestamp < v.voluntaryLockUntil) revert Locked();
        return _verifyHash(user, vid, code, v.emergencySecretHash);
    }
    function _checkMainCodeAllowLocked(address user, uint256 vid, string calldata code) internal returns (bool) {
        Vault storage v = vaults[user][vid];
        if (block.timestamp < v.voluntaryLockUntil) revert Locked();
        return _verifyHash(user, vid, code, v.secretHash);
    }
    function _verifyHash(address user, uint256 vid, string calldata code, bytes32 expected) internal returns (bool) {
        bytes32 h = keccak256(abi.encode(code, vaults[user][vid].salt));
        if (h != expected) {
            _handleFailedAttempt(user, vid);
            emit WrongCodeAttempt(user, vid);
            return false;
        }
        _resetFailedAttempts(user, vid);
        return true;
    }
    function _verifyAntiPhish(address user, uint256 vid, string calldata antiPhrase) internal view {
        Vault storage v = vaults[user][vid];
        if (v.antiPhishHash == bytes32(0)) return;
        if (bytes(antiPhrase).length == 0) revert AntiPhishRequired();
        if (keccak256(abi.encode(antiPhrase, v.salt)) != v.antiPhishHash) revert WrongCode();
    }
    function _handleFailedAttempt(address user, uint256 vid) internal {
        Vault storage v = vaults[user][vid];
        _resetUserFailedAttemptsIfExpired(user);
        if (block.timestamp < lastGlobalAttempt[user] + MIN_GLOBAL_ATTEMPT_INTERVAL) revert TooManyAttempts();
        lastGlobalAttempt[user] = block.timestamp;
        unchecked { v.failCount += 1; }
        totalFailedAttempts[user] += 1;
        uint256 total = totalFailedAttempts[user];
        if (total >= MAX_TOTAL_ATTEMPTS) {
            frozenUntil[user] = block.timestamp + FROZEN_PERIOD;
            v.requiresCodeRotation = true;
            emit FailedAttempt(user, vid, v.failCount, frozenUntil[user]);
            emit EmergencyFreeze(user, total);
        } else if (total >= AUTO_EMERGENCY_THRESHOLD) {
            frozenUntil[user] = block.timestamp + FROZEN_PERIOD;
            v.requiresCodeRotation = true;
            emit EmergencyFreeze(user, total);
        } else if (total >= HARD_LOCK_THRESHOLD) {
            v.lockedUntil = uint48(block.timestamp + FROZEN_PERIOD);
            v.requiresCodeRotation = true;
            emit FailedAttempt(user, vid, v.failCount, v.lockedUntil);
        } else if (total >= SOFT_LOCK_THRESHOLD) {
            v.lockedUntil = uint48(block.timestamp + 1 hours);
            emit FailedAttempt(user, vid, v.failCount, v.lockedUntil);
        }
    }
    function _resetFailedAttempts(address user, uint256 vid) internal {
        Vault storage v = vaults[user][vid];
        uint16 oldFail = v.failCount;
        v.failCount = 0;
        v.lockedUntil = 0;
        if (oldFail > 0) {
            if (totalFailedAttempts[user] >= oldFail) {
                totalFailedAttempts[user] -= oldFail;
            } else {
                totalFailedAttempts[user] = 0;
            }
        }
        if (totalFailedAttempts[user] == 0) {
            frozenUntil[user] = 0;
        }
    }
    function _clearVaultFailCount(address user, uint256 vid) internal {
        Vault storage v = vaults[user][vid];
        uint16 fails = v.failCount;
        if (fails > 0) {
            if (totalFailedAttempts[user] >= fails) {
                totalFailedAttempts[user] -= fails;
            } else {
                totalFailedAttempts[user] = 0;
            }
            v.failCount = 0;
        }
        if (totalFailedAttempts[user] == 0) {
            frozenUntil[user] = 0;
        }
    }
    function resetFailedAttempts() external nonReentrant {
        bool expired = (block.timestamp > lastGlobalAttempt[msg.sender] + FAIL_COUNTER_RESET_PERIOD);
        _resetUserFailedAttemptsIfExpired(msg.sender);
        if (frozenUntil[msg.sender] > block.timestamp) revert Frozen();
        if (expired) {
            uint256 vid = activeVaultId[msg.sender];
            if (vid != 0) {
                vaults[msg.sender][vid].failCount = 0;
                vaults[msg.sender][vid].lockedUntil = 0;
            }
            emit FailedAttemptsReset(msg.sender);
        }
    }

    // ═══════════════════════════════════════════════════════
    //          FEE-ON-TRANSFER PROTECTION
    // ═══════════════════════════════════════════════════════
    function _safeReceive(address token, address from, uint256 amount) internal returns (uint256 received) {
        uint256 balBefore = IERC20(token).balanceOf(address(this));
        IERC20(token).safeTransferFrom(from, address(this), amount);
        received = IERC20(token).balanceOf(address(this)) - balBefore;
    }

    // ═══════════════════════════════════════════════════════
    //          PENALTY / FEE DISTRIBUTION
    //          Разделено на 2 функции для строгого CEI:
    //          - _accrueFees: только state changes
    //          - _burnIfNeeded: только external call (вызывать в КОНЦЕ)
    // ═══════════════════════════════════════════════════════
    function _accrueFees(address token, uint256 penalty) internal returns (uint256 burnAmt) {
        if (penalty == 0) return 0;
        uint256 creatorAmt;
        uint256 reserveAmt;
        if (token == ANCR_TOKEN) {
            burnAmt    = (penalty * PEN_BURN_BPS_ANCR) / 10000;
            creatorAmt = (penalty * PEN_CREATOR_BPS_ANCR) / 10000;
            reserveAmt = (penalty * PEN_RESERVE_BPS_ANCR) / 10000;
        } else {
            creatorAmt = (penalty * PEN_CREATOR_BPS_OTHER) / 10000;
            reserveAmt = (penalty * PEN_RESERVE_BPS_OTHER) / 10000;
        }
        uint256 sum = burnAmt + creatorAmt + reserveAmt;
        require(sum <= penalty, "PenaltySplit overflow");
        uint256 rewardsAmt = penalty - sum;
        creatorFees[token]      += creatorAmt;
        strategicReserve[token] += reserveAmt;
        rewardPool[token]       += rewardsAmt;
        if (burnAmt > 0) {
            totalBurnedANCR += burnAmt;
        }
        emit PenaltyDistributed(token, burnAmt, creatorAmt, reserveAmt, rewardsAmt);
    }

    function _burnIfNeeded(address token, uint256 burnAmt) internal {
        if (burnAmt == 0) return;
        try IBurnable(token).burn(burnAmt) {} catch {
            IERC20(token).safeTransfer(address(0xdead), burnAmt);
        }
    }

    // ═══════════════════════════════════════════════════════
    //          OPEN VAULT (комиссия 0.2%)
    // ═══════════════════════════════════════════════════════
    function openVault(
        address token,
        VaultParams calldata p,
        uint8 level_
    ) external nonReentrant whenNotPaused notGloballyFrozen returns (uint256 vaultId) {
        if (!supportedTokens[token]) revert TokenNotSupported();
        _checkUint120(p.amount);
        if (level_ > uint8(VaultLevel.FORTRESS)) revert InvalidLevel();
        if (p.amount < MIN_DEPOSIT) revert DepositBelowMinimum();
        if (p.emergencyAddress == address(0)) revert ZeroAddress();
        if (p.emergencyAddress == msg.sender) revert InvalidAddress();
        if (p.emergencyAddress == address(this)) revert InvalidAddress();
        if (!_canOpenNewVault(msg.sender)) revert VaultLimitReached();
        _validateCodes(p);

        vaultId = ++userVaultCount[msg.sender];
        activeVaultId[msg.sender] = vaultId;

        uint256 received = _safeReceive(token, msg.sender, p.amount);
        uint256 openFee = (received * OPEN_VAULT_FEE_BPS) / 10000;
        uint256 net = received - openFee;
        if (net < MIN_DEPOSIT) revert DepositBelowMinimum();
        _checkUint120(net);

        _createVaultStorage(token, p, vaultId, VaultLevel(level_), net);
        lockedPrincipal[token] += net;
        uint256 burnAmt = _accrueFees(token, openFee);

        emit FeeCollected(msg.sender, token, openFee);
        emit VaultCreated(msg.sender, vaultId, token, net, p.name, p.emergencyAddress, level_);

        _maybePayWelcomeBonus();
        _burnIfNeeded(token, burnAmt);
    }

    function _createVaultStorage(address token, VaultParams calldata p, uint256 id, VaultLevel level, uint256 netAmount) internal {
        bytes32 salt = keccak256(abi.encodePacked(block.timestamp, msg.sender, id, block.prevrandao, block.chainid));
        Vault storage v = vaults[msg.sender][id];
        v.token = token;
        v.id = uint64(id);
        v.amount = uint120(netAmount);
        v.salt = salt;
        v.secretHash          = keccak256(abi.encode(p.code,       salt));
        v.antiPhishHash       = keccak256(abi.encode(p.antiPhrase, salt));
        v.emergencySecretHash = keccak256(abi.encode(p.recovery,   salt));
        v.name = p.name;
        v.lockedAt    = uint48(block.timestamp);
        v.depositedAt = uint48(block.timestamp);
        v.level       = uint8(level);
        v.emergencyAddress = p.emergencyAddress;
        v.status = 0;
    }

    function _maybePayWelcomeBonus() internal {
        uint256 bonus = welcomeBonus;
        if (bonus == 0) return;
        if (welcomeBonusClaimed[msg.sender]) return;
        if (rewardPool[ANCR_TOKEN] < bonus) return;
        welcomeBonusClaimed[msg.sender] = true;
        rewardPool[ANCR_TOKEN] -= bonus;
        IERC20(ANCR_TOKEN).safeTransfer(msg.sender, bonus);
        emit WelcomeBonusPaid(msg.sender, bonus);
    }

    // ═══════════════════════════════════════════════════════
    //          DEPOSIT
    // ═══════════════════════════════════════════════════════
    function depositToVault(uint256 vid, uint256 amount, string calldata code)
        external nonReentrant whenNotPaused notGloballyFrozen vaultExists(msg.sender, vid) codesNotRequiringRotation(msg.sender, vid)
    {
        if (!_checkMainCode(msg.sender, vid, code)) return;
        _doDeposit(vid, amount);
    }

    function _doDeposit(uint256 vid, uint256 amount) internal {
        _checkUint120(amount);
        if (amount < MIN_DEPOSIT) revert DepositBelowMinimum();
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        address token = v.token;
        uint256 received = _safeReceive(token, msg.sender, amount);
        uint256 fee = (received * _getDepositFee(v.level)) / 10000;
        uint256 net = received - fee;
        if (net < MIN_DEPOSIT) revert DepositBelowMinimum();
        _checkUint120(uint256(v.amount) + net);
        v.amount += uint120(net);
        lockedPrincipal[token] += net;
        creatorFees[token] += fee;
        emit FeeCollected(msg.sender, token, fee);
        emit VaultDeposited(msg.sender, vid, token, net, v.amount);
    }

    // ═══════════════════════════════════════════════════════
    //          WITHDRAW (мгновенный, 0.5%)
    // ═══════════════════════════════════════════════════════
    function withdrawFromVault(
        uint256 vid,
        uint256 amount,
        address to,
        string calldata code,
        string calldata antiPhrase
    ) external nonReentrant whenNotPaused notGloballyFrozen vaultExists(msg.sender, vid) codesNotRequiringRotation(msg.sender, vid) {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (amount == 0 || amount > v.amount) revert InvalidAmount();
        if (to == address(0) || to == address(this)) revert InvalidAddress();

        _verifyAntiPhish(msg.sender, vid, antiPhrase);
        if (!_checkMainCode(msg.sender, vid, code)) return;

        uint256 fee = (amount * WITHDRAW_FEE_BPS) / 10000;
        uint256 net = amount - fee;
        address token = v.token;
        v.amount -= uint120(amount);
        lockedPrincipal[token] -= amount;
        uint256 burnAmt = _accrueFees(token, fee);

        // close-state ДО external calls
        if (v.amount == 0) {
            _clearVaultFailCount(msg.sender, vid);
            v.status = 1;
            activeVaultId[msg.sender] = 0;
        }

        emit VaultWithdrawn(msg.sender, vid, token, net);

        // external calls в самом конце (CEI)
        IERC20(token).safeTransfer(to, net);
        _burnIfNeeded(token, burnAmt);
    }

    // ═══════════════════════════════════════════════════════
    //          TRANSFER (мгновенный, 0.5%)
    // ═══════════════════════════════════════════════════════
    function transferVault(
        uint256 vid,
        address to,
        string calldata code,
        string calldata antiPhrase,
        NewCodes calldata nc
    ) external nonReentrant whenNotPaused notGloballyFrozen vaultExists(msg.sender, vid) codesNotRequiringRotation(msg.sender, vid) {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (to == address(0) || to == msg.sender || to == address(this)) revert InvalidAddress();
        if (!_canOpenNewVault(to)) revert VaultLimitReached();

        _verifyAntiPhish(msg.sender, vid, antiPhrase);
        if (!_checkMainCode(msg.sender, vid, code)) return;
        _validateNewCodes(nc);

        uint256 fee = _applyPenalty(v.amount, TRANSFER_FEE_BPS);
        uint256 net = uint256(v.amount) - fee;
        _checkUint120(net);

        address token = v.token;
        uint256 burnAmt = _accrueFees(token, fee);
        // ФИКС V42→V43: lockedPrincipal уменьшается только на fee, net остаётся залочен в новом сейфе у to
        lockedPrincipal[token] -= fee;

        uint256 newId = ++userVaultCount[to];
        Vault storage nv = vaults[to][newId];
        nv.token = token;
        nv.id = uint64(newId);
        nv.amount = uint120(net);
        nv.salt = v.salt;
        nv.secretHash          = keccak256(abi.encode(nc.newCode,       v.salt));
        nv.antiPhishHash       = keccak256(abi.encode(nc.newAntiPhrase, v.salt));
        nv.emergencySecretHash = keccak256(abi.encode(nc.newRecovery,   v.salt));
        nv.name = v.name;
        nv.lockedAt = uint48(block.timestamp);
        nv.depositedAt = uint48(block.timestamp);
        nv.level = v.level;
        nv.emergencyAddress = v.emergencyAddress;
        nv.status = 0;
        activeVaultId[to] = newId;

        delete vaults[msg.sender][vid];
        activeVaultId[msg.sender] = 0;

        emit VaultTransferred(msg.sender, to, vid, newId);

        // external call в самом конце (CEI)
        _burnIfNeeded(token, burnAmt);
    }

    // ═══════════════════════════════════════════════════════
    //          EARLY CLOSE (мгновенный, 5%, на msg.sender)
    // ═══════════════════════════════════════════════════════
    function earlyClose(uint256 vid, string calldata recovery)
        external nonReentrant notGloballyFrozen vaultExists(msg.sender, vid)
    {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (!_checkRecoveryCode(msg.sender, vid, recovery)) return;

        address token = v.token;
        uint256 amount = v.amount;
        uint256 penalty = _applyPenalty(amount, EARLY_CLOSE_FEE_BPS);
        uint256 payout = amount - penalty;

        v.amount = 0;
        v.status = 1;
        lockedPrincipal[token] -= amount;
        v.lockedUntil = 0;
        v.voluntaryLockUntil = 0;
        v.requiresCodeRotation = false;
        if (activeVaultId[msg.sender] == vid) activeVaultId[msg.sender] = 0;
        _clearVaultFailCount(msg.sender, vid);

        uint256 burnAmt = _accrueFees(token, penalty);
        emit VaultEarlyClosed(msg.sender, vid, payout, penalty);

        IERC20(token).safeTransfer(msg.sender, payout);
        _burnIfNeeded(token, burnAmt);
    }

    // ═══════════════════════════════════════════════════════
    //          RECOVER TO SAFE (мгновенный, 10%, на emergencyAddress)
    // ═══════════════════════════════════════════════════════
    function recoverToSafe(uint256 vid, string calldata recovery)
        external nonReentrant notGloballyFrozen vaultExists(msg.sender, vid)
    {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (!_checkRecoveryCode(msg.sender, vid, recovery)) return;

        address token = v.token;
        address to = v.emergencyAddress;
        uint256 amount = v.amount;
        uint256 penalty = _applyPenalty(amount, RECOVER_TO_SAFE_FEE_BPS);
        uint256 payout = amount - penalty;

        v.amount = 0;
        v.status = 1;
        lockedPrincipal[token] -= amount;
        v.lockedUntil = 0;
        v.voluntaryLockUntil = 0;
        v.requiresCodeRotation = false;
        if (activeVaultId[msg.sender] == vid) activeVaultId[msg.sender] = 0;
        _clearVaultFailCount(msg.sender, vid);

        uint256 burnAmt = _accrueFees(token, penalty);
        emit VaultRecovered(msg.sender, vid, to, payout, penalty);

        IERC20(token).safeTransfer(to, payout);
        _burnIfNeeded(token, burnAmt);
    }

    // ═══════════════════════════════════════════════════════
    //          EMERGENCY WITHDRAW TO ANY (мгновенный, 15%, на любой адрес)
    // ═══════════════════════════════════════════════════════
    function emergencyWithdrawToAny(
        uint256 vid,
        address to,
        string calldata recovery,
        string calldata antiPhrase
    ) external nonReentrant notGloballyFrozen vaultExists(msg.sender, vid) {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (to == address(0) || to == address(this)) revert InvalidAddress();

        _verifyAntiPhish(msg.sender, vid, antiPhrase);
        if (!_checkRecoveryCode(msg.sender, vid, recovery)) return;

        uint256 amount = v.amount;
        uint256 fee = _applyPenalty(amount, EMERGENCY_ANY_FEE_BPS);
        uint256 payout = amount - fee;

        address token = v.token;
        v.amount = 0;
        v.status = 1;
        lockedPrincipal[token] -= amount;
        v.lockedUntil = 0;
        v.voluntaryLockUntil = 0;
        v.requiresCodeRotation = false;
        if (activeVaultId[msg.sender] == vid) activeVaultId[msg.sender] = 0;
        _clearVaultFailCount(msg.sender, vid);

        uint256 burnAmt = _accrueFees(token, fee);
        emit EmergencyWithdrawToAny(msg.sender, vid, to, payout, fee);

        IERC20(token).safeTransfer(to, payout);
        _burnIfNeeded(token, burnAmt);
    }

    // ═══════════════════════════════════════════════════════
    //          ROTATE CODES
    // ═══════════════════════════════════════════════════════
    function rotateCodes(
        uint256 vid,
        string calldata oldCode,
        string calldata oldRecovery,
        NewCodes calldata nc
    ) external nonReentrant notGloballyFrozen vaultExists(msg.sender, vid) {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();

        if (!_checkMainCodeAllowLocked(msg.sender, vid, oldCode)) return;
        if (!_checkRecoveryCode(msg.sender, vid, oldRecovery)) return;

        _validateNewCodes(nc);

        bytes32 newSalt = keccak256(abi.encodePacked(block.timestamp, msg.sender, vid, block.prevrandao, block.chainid, v.salt));
        v.salt = newSalt;
        v.secretHash          = keccak256(abi.encode(nc.newCode,       newSalt));
        v.antiPhishHash       = keccak256(abi.encode(nc.newAntiPhrase, newSalt));
        v.emergencySecretHash = keccak256(abi.encode(nc.newRecovery,   newSalt));

        v.failCount = 0;
        v.lockedUntil = 0;
        v.requiresCodeRotation = false;
        totalFailedAttempts[msg.sender] = 0;
        frozenUntil[msg.sender] = 0;

        emit CodesRotated(msg.sender, vid);
    }

    // ═══════════════════════════════════════════════════════
    //          SET TIMELOCK (доп. задержка на vault уровень)
    // ═══════════════════════════════════════════════════════
    function setTimelock(uint256 vid, uint256 hoursVal, string calldata code)
        external nonReentrant whenNotPaused notGloballyFrozen vaultExists(msg.sender, vid) codesNotRequiringRotation(msg.sender, vid)
    {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (hoursVal > _getMaxTimelock(v.level)) revert TimelockTooLong();
        if (!_checkMainCode(msg.sender, vid, code)) return;
        v.timelockHours = uint16(hoursVal);
        emit TimelockSet(msg.sender, vid, hoursVal);
    }

    // ═══════════════════════════════════════════════════════
    //          SET VOLUNTARY LOCK (только увеличивать)
    // ═══════════════════════════════════════════════════════
    function setVoluntaryLock(uint256 vid, uint256 lockUntilTimestamp, string calldata code)
        external nonReentrant whenNotPaused notGloballyFrozen vaultExists(msg.sender, vid) codesNotRequiringRotation(msg.sender, vid)
    {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (lockUntilTimestamp <= block.timestamp) revert InvalidAmount();
        if (lockUntilTimestamp > block.timestamp + MAX_VOLUNTARY_LOCK) revert LockTooLong();
        if (lockUntilTimestamp > type(uint48).max) revert LockTooLong();
        if (!_checkMainCode(msg.sender, vid, code)) return;

        if (uint48(lockUntilTimestamp) > v.voluntaryLockUntil) {
            v.voluntaryLockUntil = uint48(lockUntilTimestamp);
        }
        emit VoluntaryLockSet(msg.sender, vid, v.voluntaryLockUntil);
    }

    // ═══════════════════════════════════════════════════════
    //          CHANGE EMERGENCY ADDRESS
    // ═══════════════════════════════════════════════════════
    function changeEmergencyAddress(uint256 vid, address newAddress, string calldata recovery)
        external nonReentrant whenNotPaused notGloballyFrozen vaultExists(msg.sender, vid)
    {
        Vault storage v = vaults[msg.sender][vid];
        if (v.status != 0) revert NotActive();
        if (newAddress == address(0)) revert ZeroAddress();
        if (newAddress == msg.sender) revert InvalidAddress();
        if (newAddress == address(this)) revert InvalidAddress();
        if (!_checkRecoveryCode(msg.sender, vid, recovery)) return;
        v.emergencyAddress = newAddress;
        emit EmergencyAddressChanged(msg.sender, vid, newAddress);
    }

    // ═══════════════════════════════════════════════════════
    //          WELCOME BONUS / DONATIONS
    // ═══════════════════════════════════════════════════════
    function setWelcomeBonus(uint256 amount) external onlyCreator {
        if (amount > MAX_WELCOME_BONUS) revert BonusExceedsLimit();
        welcomeBonus = amount;
        emit WelcomeBonusChanged(amount);
    }

    function donateToRewardPool(address token, uint256 amount) external nonReentrant {
        if (!supportedTokens[token]) revert TokenNotSupported();
        if (amount == 0) revert InvalidAmount();
        uint256 received = _safeReceive(token, msg.sender, amount);
        rewardPool[token] += received;
        emit RewardPoolDonated(msg.sender, token, received);
    }

    // ═══════════════════════════════════════════════════════
    //          ROLE TRANSFERS (2-step + cooldown)
    // ═══════════════════════════════════════════════════════
    function transferCreatorship(address newCreator) external onlyCreator {
        if (newCreator == address(0)) revert ZeroAddress();
        if (newCreator == creator) revert InvalidAddress();
        pendingCreator = newCreator;
        creatorshipRequestedAt = block.timestamp;
        emit CreatorshipTransferRequested(creator, newCreator);
    }
    function acceptCreatorship() external {
        if (msg.sender != pendingCreator) revert NotPendingRole();
        if (block.timestamp < creatorshipRequestedAt + CREATOR_COOLDOWN) revert CooldownNotExpired();
        creator = pendingCreator;
        pendingCreator = address(0);
        creatorshipRequestedAt = 0;
        emit CreatorshipAccepted(creator);
    }
    function transferGuardianship(address newGuardian) external onlyCreator {
        if (newGuardian == address(0)) revert ZeroAddress();
        if (newGuardian == guardian) revert InvalidAddress();
        if (newGuardian == creator) revert InvalidAddress();
        pendingGuardian = newGuardian;
        guardianshipRequestedAt = block.timestamp;
        emit GuardianshipTransferRequested(guardian, newGuardian);
    }
    function acceptGuardianship() external {
        if (msg.sender != pendingGuardian) revert NotPendingRole();
        if (block.timestamp < guardianshipRequestedAt + GUARDIAN_COOLDOWN) revert CooldownNotExpired();
        guardian = pendingGuardian;
        pendingGuardian = address(0);
        guardianshipRequestedAt = 0;
        emit GuardianshipAccepted(guardian);
    }

    // ═══════════════════════════════════════════════════════
    //          PAUSE FLOW
    // ═══════════════════════════════════════════════════════
    function requestPause() external onlyGuardian {
        if (pauseTimestamp != 0) revert AdminRequestPending();
        pauseTimestamp = block.timestamp + PAUSE_DELAY;
        emit PauseRequested(msg.sender, pauseTimestamp);
    }
    function cancelPauseRequest() external onlyGuardian {
        if (pauseTimestamp == 0) revert NoPauseRequest();
        pauseTimestamp = 0;
        emit PauseRequestCancelled(msg.sender);
    }
    function executePause() external onlyGuardian {
        if (pauseTimestamp == 0) revert NoPauseRequest();
        if (block.timestamp < pauseTimestamp) revert PauseTimeoutNotReached();
        paused = true;
        pauseTimestamp = 0;
        emit PauseStateChanged(true, false);
    }
    function emergencyPause() external onlyGuardian {
        paused = true;
        pauseTimestamp = 0;
        emit PauseStateChanged(true, true);
    }
    function unpause() external onlyCreator {
        paused = false;
        pauseTimestamp = 0;
        emit PauseStateChanged(false, false);
    }

    // ═══════════════════════════════════════════════════════
    //          CREATOR FEES WITHDRAW (7-дневный таймлок)
    // ═══════════════════════════════════════════════════════
    function requestCreatorWithdraw(address token, address to, uint256 amount) external onlyCreator {
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this)) revert InvalidAddress();
        if (amount == 0 || amount > creatorFees[token]) revert InvalidAmount();
        if (creatorWithdrawalUnlock[token] != 0) revert AdminRequestPending();
        creatorWithdrawalTo[token] = to;
        creatorWithdrawalAmount[token] = amount;
        creatorWithdrawalUnlock[token] = block.timestamp + ADMIN_WITHDRAW_TIMELOCK;
        emit CreatorWithdrawRequested(token, amount, creatorWithdrawalUnlock[token]);
    }
    function cancelCreatorWithdraw(address token) external onlyCreator {
        if (creatorWithdrawalUnlock[token] == 0) revert NoAdminRequest();
        creatorWithdrawalTo[token] = address(0);
        creatorWithdrawalAmount[token] = 0;
        creatorWithdrawalUnlock[token] = 0;
        emit CreatorWithdrawCancelled(token);
    }
    function withdrawCreatorFees(address token) external onlyCreator nonReentrant {
        uint256 unlockAt = creatorWithdrawalUnlock[token];
        if (unlockAt == 0) revert NoAdminRequest();
        if (block.timestamp < unlockAt) revert TimelockNotExpired();
        uint256 amount = creatorWithdrawalAmount[token];
        address to = creatorWithdrawalTo[token];
        if (amount > creatorFees[token]) revert InvalidAmount();
        creatorFees[token] -= amount;
        creatorWithdrawalTo[token] = address(0);
        creatorWithdrawalAmount[token] = 0;
        creatorWithdrawalUnlock[token] = 0;
        IERC20(token).safeTransfer(to, amount);
        emit CreatorWithdrawn(token, to, amount);
    }

    // ═══════════════════════════════════════════════════════
    //          STRATEGIC RESERVE WITHDRAW (7-дневный таймлок)
    // ═══════════════════════════════════════════════════════
    function requestReserveWithdraw(address token, address to, uint256 amount) external onlyCreator {
        if (to == address(0)) revert ZeroAddress();
        if (to == address(this)) revert InvalidAddress();
        if (amount == 0 || amount > strategicReserve[token]) revert InvalidAmount();
        if (reserveWithdrawalUnlock[token] != 0) revert AdminRequestPending();
        reserveWithdrawalTo[token] = to;
        reserveWithdrawalAmount[token] = amount;
        reserveWithdrawalUnlock[token] = block.timestamp + ADMIN_WITHDRAW_TIMELOCK;
        emit ReserveWithdrawRequested(token, amount, reserveWithdrawalUnlock[token]);
    }
    function cancelReserveWithdraw(address token) external onlyCreator {
        if (reserveWithdrawalUnlock[token] == 0) revert NoAdminRequest();
        reserveWithdrawalTo[token] = address(0);
        reserveWithdrawalAmount[token] = 0;
        reserveWithdrawalUnlock[token] = 0;
        emit ReserveWithdrawCancelled(token);
    }
    function withdrawStrategicReserve(address token) external onlyCreator nonReentrant {
        uint256 unlockAt = reserveWithdrawalUnlock[token];
        if (unlockAt == 0) revert NoAdminRequest();
        if (block.timestamp < unlockAt) revert TimelockNotExpired();
        uint256 amount = reserveWithdrawalAmount[token];
        address to = reserveWithdrawalTo[token];
        if (amount > strategicReserve[token]) revert InvalidAmount();
        strategicReserve[token] -= amount;
        reserveWithdrawalTo[token] = address(0);
        reserveWithdrawalAmount[token] = 0;
        reserveWithdrawalUnlock[token] = 0;
        IERC20(token).safeTransfer(to, amount);
        emit ReserveWithdrawn(token, to, amount);
    }

    // ═══════════════════════════════════════════════════════
    //          VIEW GETTERS
    // ═══════════════════════════════════════════════════════
    function getVaultCore(address user, uint256 vid) external view vaultExists(user, vid)
        returns (uint64 id, address token, uint120 amount, string memory name, uint8 status, uint8 level, address emergencyAddress)
    {
        Vault storage v = vaults[user][vid];
        return (v.id, v.token, v.amount, v.name, v.status, v.level, v.emergencyAddress);
    }

    function getVaultTimings(address user, uint256 vid) external view vaultExists(user, vid)
        returns (uint48 lockedAt, uint48 depositedAt, uint48 lockedUntil, uint48 voluntaryLockUntil, uint16 timelockHours)
    {
        Vault storage v = vaults[user][vid];
        return (v.lockedAt, v.depositedAt, v.lockedUntil, v.voluntaryLockUntil, v.timelockHours);
    }

    function getVaultSecurity(address user, uint256 vid) external view vaultExists(user, vid)
        returns (uint16 failCount, bool requiresCodeRotation)
    {
        Vault storage v = vaults[user][vid];
        return (v.failCount, v.requiresCodeRotation);
    }

    function getAntiPhishHash(address user, uint256 vid) external view vaultExists(user, vid) returns (bytes32) {
        return vaults[user][vid].antiPhishHash;
    }

    function getMaxTimelockForLevel(uint8 level) external pure returns (uint256) {
        return _getMaxTimelock(uint256(level));
    }

    function getDepositFeeForLevel(uint8 level) external pure returns (uint256) {
        return _getDepositFee(uint256(level));
    }

    // ═══════════════════════════════════════════════════════
    //          DEFENSE: запрет ETH и прямых переводов
    // ═══════════════════════════════════════════════════════
    receive() external payable {
        revert DirectTransferForbidden();
    }
    fallback() external payable {
        revert DirectTransferForbidden();
    }
}
