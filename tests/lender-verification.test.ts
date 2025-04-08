import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mockClarity } from './mock-clarity';

// Mock the Clarity environment
const clarity = mockClarity();

// Import the contract (mocked)
const contract = clarity.importContract('./contracts/lender-verification.clar');

describe('Lender Verification Contract', () => {
  beforeEach(() => {
    clarity.reset();
  });
  
  it('should register a new lender', async () => {
    // Set up test data
    const lender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const name = 'Finance Corp';
    const licenseId = 'FIN12345';
    
    // Set the tx-sender as the contract owner
    clarity.setTxSender('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    clarity.setContractOwner('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    
    // Call the register-lender function
    const result = await contract.registerLender(
        lender,
        name,
        licenseId
    );
    
    // Verify the result
    expect(result.success).toBe(true);
    
    // Verify the lender was stored correctly
    const lenderData = await contract.getLenderData(lender);
    expect(lenderData.success).toBe(true);
    expect(lenderData.value.name).toBe(name);
    expect(lenderData.value.licenseId).toBe(licenseId);
    expect(lenderData.value.isActive).toBe(true);
  });
  
  it('should verify a lender is active', async () => {
    // First register a lender
    const lender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    clarity.setTxSender('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    clarity.setContractOwner('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    
    await contract.registerLender(
        lender,
        'Finance Corp',
        'FIN12345'
    );
    
    // Check if the lender is verified
    const isVerified = await contract.isVerifiedLender(lender);
    
    // Verify the result
    expect(isVerified.success).toBe(true);
    expect(isVerified.value).toBe(true);
  });
  
  it('should deactivate a lender', async () => {
    // First register a lender
    const lender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    clarity.setTxSender('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    clarity.setContractOwner('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    
    await contract.registerLender(
        lender,
        'Finance Corp',
        'FIN12345'
    );
    
    // Deactivate the lender
    const deactivateResult = await contract.deactivateLender(lender);
    
    // Verify the deactivation was successful
    expect(deactivateResult.success).toBe(true);
    
    // Verify the lender is no longer active
    const isVerified = await contract.isVerifiedLender(lender);
    expect(isVerified.value).toBe(false);
  });
  
  it('should fail to register a lender if not the contract owner', async () => {
    // Set up test data
    const lender = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG';
    const name = 'Finance Corp';
    const licenseId = 'FIN12345';
    
    // Set the tx-sender as someone other than the contract owner
    clarity.setTxSender('ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP');
    clarity.setContractOwner('ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM');
    
    // Call the register-lender function
    const result = await contract.registerLender(
        lender,
        name,
        licenseId
    );
    
    // Verify the result
    expect(result.success).toBe(false);
    expect(result.error).toBe(403); // Unauthorized
  });
});
