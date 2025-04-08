import { vi } from 'vitest';

/**
 * Creates a mock Clarity environment for testing
 */
export function mockClarity() {
	// Storage for contract data
	const storage = {
		maps: {},
		vars: {},
		nfts: {}
	};
	
	// Current transaction context
	let context = {
		sender: null,
		contractOwner: null,
		contractCaller: null,
		blockHeight: 1
	};
	
	// Linked contracts for cross-contract calls
	let linkedContracts = {};
	
	return {
		reset() {
			// Reset storage
			storage.maps = {};
			storage.vars = {};
			storage.nfts = {};
			
			// Reset context
			context.sender = null;
			context.contractOwner = null;
			context.contractCaller = null;
			context.blockHeight = 1;
			
			// Reset linked contracts
			linkedContracts = {};
		},
		
		setTxSender(principal) {
			context.sender = principal;
		},
		
		setContractOwner(principal) {
			context.contractOwner = principal;
		},
		
		setContractCaller(contractName) {
			context.contractCaller = contractName;
		},
		
		setBlockHeight(height) {
			context.blockHeight = height;
		},
		
		linkContracts(contracts) {
			linkedContracts = { ...linkedContracts, ...contracts };
		},
		
		importContract(path) {
			// This would normally load and parse the contract
			// For testing, we'll return a mock contract interface
			const contractName = path.split('/').pop().replace('.clar', '');
			
			// Create mock functions based on the contract name
			const contractMock = {};
			
			switch (contractName) {
				case 'asset-registration':
					contractMock.registerAsset = vi.fn(async (name, description, serialNumber, manufacturer, manufactureDate, value) => {
						const lastAssetId = storage.vars.lastAssetId || 0;
						const newAssetId = lastAssetId + 1;
						
						storage.vars.lastAssetId = newAssetId;
						
						if (!storage.maps.assets) {
							storage.maps.assets = {};
						}
						
						storage.maps.assets[newAssetId] = {
							owner: context.sender,
							name,
							description,
							serialNumber,
							manufacturer,
							manufactureDate,
							value,
							status: 'available'
						};
						
						return { success: true, value: newAssetId };
					});
					
					contractMock.getAsset = vi.fn(async (assetId) => {
						if (!storage.maps.assets || !storage.maps.assets[assetId]) {
							return { success: false, error: 404 };
						}
						
						return { success: true, value: storage.maps.assets[assetId] };
					});
					
					contractMock.updateAssetStatus = vi.fn(async (assetId, newStatus) => {
						if (!storage.maps.assets || !storage.maps.assets[assetId]) {
							return { success: false, error: 404 };
						}
						
						if (storage.maps.assets[assetId].owner !== context.sender) {
							return { success: false, error: 403 };
						}
						
						storage.maps.assets[assetId].status = newStatus;
						
						return { success: true };
					});
					
					contractMock.transferAsset = vi.fn(async (assetId, newOwner) => {
						if (!storage.maps.assets || !storage.maps.assets[assetId]) {
							return { success: false, error: 404 };
						}
						
						if (storage.maps.assets[assetId].owner !== context.sender) {
							return { success: false, error: 403 };
						}
						
						storage.maps.assets[assetId].owner = newOwner;
						
						return { success: true };
					});
					break;
				
				case 'lender-verification':
					contractMock.registerLender = vi.fn(async (lender, name, licenseId) => {
						if (context.sender !== context.contractOwner) {
							return { success: false, error: 403 };
						}
						
						if (!storage.maps.verifiedLenders) {
							storage.maps.verifiedLenders = {};
						}
						
						storage.maps.verifiedLenders[lender] = {
							name,
							licenseId,
							verificationDate: context.blockHeight,
							isActive: true
						};
						
						return { success: true };
					});
					
					contractMock.getLenderData = vi.fn(async (lender) => {
						if (!storage.maps.verifiedLenders || !storage.maps.verifiedLenders[lender]) {
							return { success: false, error: 404 };
						}
						
						return { success: true, value: storage.maps.verifiedLenders[lender] };
					});
					
					contractMock.isVerifiedLender = vi.fn(async (lender) => {
						if (!storage.maps.verifiedLenders || !storage.maps.verifiedLenders[lender]) {
							return { success: true, value: false };
						}
						
						return { success: true, value: storage.maps.verifiedLenders[lender].isActive };
					});
					
					contractMock.deactivateLender = vi.fn(async (lender) => {
						if (context.sender !== context.contractOwner) {
							return { success: false, error: 403 };
						}
						
						if (!storage.maps.verifiedLenders || !storage.maps.verifiedLenders[lender]) {
							return { success: false, error: 404 };
						}
						
						storage.maps.verifiedLenders[lender].isActive = false;
						
						return { success: true };
					});
					
					contractMock.reactivateLender = vi.fn(async (lender) => {
						if (context.sender !== context.contractOwner) {
							return { success: false, error: 403 };
						}
						
						if (!storage.maps.verifiedLenders || !storage.maps.verifiedLenders[lender]) {
							return { success: false, error: 404 };
						}
						
						storage.maps.verifiedLenders[lender].isActive = true;
						
						return { success: true };
					});
					break;
				
				case 'loan-management':
					contractMock.createLoan = vi.fn(async (borrower, assetId, principalAmount, interestRate, termLength, totalPayments) => {
						// Check if lender is verified
						const isVerified = await linkedContracts['lender-verification'].isVerifiedLender(context.sender);
						if (!isVerified.value) {
							return { success: false, error: 401 };
						}
						
						// Check if asset exists
						const asset = await linkedContracts['asset-registration'].getAsset(assetId);
						if (!asset.success) {
							return { success: false, error: 404 };
						}
						
						const lastLoanId = storage.vars.lastLoanId || 0;
						const newLoanId = lastLoanId + 1;
						
						storage.vars.lastLoanId = newLoanId;
						
						if (!storage.maps.loans) {
							storage.maps.loans = {};
						}
						
						storage.maps.loans[newLoanId] = {
							lender: context.sender,
							borrower,
							assetId,
							principalAmount,
							interestRate,
							termLength,
							startDate: context.blockHeight,
							endDate: context.blockHeight + termLength,
							status: 'active',
							paymentsMade: 0,
							totalPayments
						};
						
						// Transfer asset to borrower
						await linkedContracts['asset-registration'].transferAsset(assetId, borrower);
						
						// Update asset status
						await linkedContracts['asset-registration'].updateAssetStatus(assetId, 'collateralized');
						
						// Register collateral
						await linkedContracts['collateral-monitoring'].registerCollateral(assetId, newLoanId);
						
						return { success: true, value: newLoanId };
					});
					
					contractMock.getLoan = vi.fn(async (loanId) => {
						if (!storage.maps.loans || !storage.maps.loans[loanId]) {
							return { success: false, error: 404 };
						}
						
						return { success: true, value: storage.maps.loans[loanId] };
					});
					
					contractMock.makePayment = vi.fn(async (loanId, amount) => {
						if (!storage.maps.loans || !storage.maps.loans[loanId]) {
							return { success: false, error: 404 };
						}
						
						const loan = storage.maps.loans[loanId];
						
						if (loan.borrower !== context.sender) {
							return { success: false, error: 403 };
						}
						
						if (loan.status !== 'active') {
							return { success: false, error: 400 };
						}
						
						const paymentNumber = loan.paymentsMade + 1;
						
						if (paymentNumber > loan.totalPayments) {
							return { success: false, error: 400 };
						}
						
						if (!storage.maps.payments) {
							storage.maps.payments = {};
						}
						
						storage.maps.payments[`${loanId}-${paymentNumber}`] = {
							amount,
							date: context.blockHeight,
							status: 'completed'
						};
						
						loan.paymentsMade = paymentNumber;
						
						// If all payments made, close the loan
						if (paymentNumber === loan.totalPayments) {
							await contractMock.closeLoan(loanId);
						}
						
						return { success: true };
					});
					
					contractMock.getPayment = vi.fn(async (loanId, paymentNumber) => {
						if (!storage.maps.payments || !storage.maps.payments[`${loanId}-${paymentNumber}`]) {
							return { success: false, error: 404 };
						}
						
						return { success: true, value: storage.maps.payments[`${loanId}-${paymentNumber}`] };
					});
					
					contractMock.closeLoan = vi.fn(async (loanId) => {
						if (!storage.maps.loans || !storage.maps.loans[loanId]) {
							return { success: false, error: 404 };
						}
						
						const loan = storage.maps.loans[loanId];
						
						if (loan.lender !== context.sender && loan.borrower !== context.sender) {
							return { success: false, error: 403 };
						}
						
						loan.status = 'closed';
						
						// Release collateral
						await linkedContracts['asset-registration'].updateAssetStatus(loan.assetId, 'available');
						await linkedContracts['collateral-monitoring'].releaseCollateral(loan.assetId);
						
						return { success: true };
					});
					break;
				
				case 'collateral-monitoring':
					contractMock.registerCollateral = vi.fn(async (assetId, loanId) => {
						if (context.contractCaller !== 'loan-management') {
							return { success: false, error: 403 };
						}
						
						if (!storage.maps.collaterals) {
							storage.maps.collaterals = {};
						}
						
						storage.maps.collaterals[assetId] = {
							loanId,
							status: 'active',
							lastInspectionDate: 0,
							condition: 'unknown'
						};
						
						if (!storage.maps.assetInspectionCount) {
							storage.maps.assetInspectionCount = {};
						}
						
						storage.maps.assetInspectionCount[assetId] = 0;
						
						return { success: true };
					});
					
					contractMock.getCollateral = vi.fn(async (assetId) => {
						if (!storage.maps.collaterals || !storage.maps.collaterals[assetId]) {
							return { success: false, error: 404 };
						}
						
						return { success: true, value: storage.maps.collaterals[assetId] };
					});
					
					contractMock.recordInspection = vi.fn(async (assetId, condition, notes) => {
						if (!storage.maps.collaterals || !storage.maps.collaterals[assetId]) {
							return { success: false, error: 404 };
						}
						
						const collateral = storage.maps.collaterals[assetId];
						
						if (collateral.status !== 'active') {
							return { success: false, error: 400 };
						}
						
						if (!storage.maps.inspections) {
							storage.maps.inspections = {};
						}
						
						const inspectionCount = storage.maps.assetInspectionCount[assetId] || 0;
						const newCount = inspectionCount + 1;
						
						storage.maps.inspections[`${assetId}-${newCount}`] = {
							inspector: context.sender,
							date: context.blockHeight,
							condition,
							notes
						};
						
						storage.maps.assetInspectionCount[assetId] = newCount;
						
						collateral.lastInspectionDate = context.blockHeight;
						collateral.condition = condition;
						
						return { success: true };
					});
					
					contractMock.getInspection = vi.fn(async (assetId, inspectionId) => {
						if (!storage.maps.inspections || !storage.maps.inspections[`${assetId}-${inspectionId}`]) {
							return { success: false, error: 404 };
						}
						
						return { success: true, value: storage.maps.inspections[`${assetId}-${inspectionId}`] };
					});
					
					contractMock.releaseCollateral = vi.fn(async (assetId) => {
						if (context.contractCaller !== 'loan-management') {
							return { success: false, error: 403 };
						}
						
						if (!storage.maps.collaterals || !storage.maps.collaterals[assetId]) {
							return { success: false, error: 404 };
						}
						
						storage.maps.collaterals[assetId].status = 'released';
						
						return { success: true };
					});
					
					contractMock.getInspectionCount = vi.fn(async (assetId) => {
						const count = storage.maps.assetInspectionCount[assetId] || 0;
						return { success: true, value: { count } };
					});
					break;
			}
			
			return contractMock;
		}
	};
}
