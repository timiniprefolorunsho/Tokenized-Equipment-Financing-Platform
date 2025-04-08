;; Loan Management Contract
;; Handles terms and repayment schedules

(define-data-var last-loan-id uint u0)

(define-map loans
  { loan-id: uint }
  {
    lender: principal,
    borrower: principal,
    asset-id: uint,
    principal-amount: uint,
    interest-rate: uint,
    term-length: uint,
    start-date: uint,
    end-date: uint,
    status: (string-ascii 20),
    payments-made: uint,
    total-payments: uint
  }
)

(define-map payments
  { loan-id: uint, payment-number: uint }
  {
    amount: uint,
    date: uint,
    status: (string-ascii 20)
  }
)

(define-public (create-loan
    (borrower principal)
    (asset-id uint)
    (principal-amount uint)
    (interest-rate uint)
    (term-length uint)
    (total-payments uint))
  (let (
    (asset-contract (contract-call? .asset-registration get-asset asset-id))
    (new-loan-id (+ (var-get last-loan-id) u1))
    (is-verified (contract-call? .lender-verification is-verified-lender tx-sender))
  )
    (asserts! is-verified (err u401))
    (asserts! (is-some asset-contract) (err u404))

    (var-set last-loan-id new-loan-id)
    (map-set loans
      { loan-id: new-loan-id }
      {
        lender: tx-sender,
        borrower: borrower,
        asset-id: asset-id,
        principal-amount: principal-amount,
        interest-rate: interest-rate,
        term-length: term-length,
        start-date: block-height,
        end-date: (+ block-height term-length),
        status: "active",
        payments-made: u0,
        total-payments: total-payments
      }
    )

    ;; Transfer asset to borrower as collateral
    (contract-call? .asset-registration transfer-asset asset-id borrower)

    ;; Update asset status
    (contract-call? .asset-registration update-asset-status asset-id "collateralized")

    ;; Notify collateral monitoring
    (contract-call? .collateral-monitoring register-collateral asset-id new-loan-id)

    (ok new-loan-id)
  )
)

(define-public (make-payment (loan-id uint) (amount uint))
  (let (
    (loan (unwrap! (get-loan loan-id) (err u404)))
    (payment-number (+ (get payments-made loan) u1))
  )
    (asserts! (is-eq tx-sender (get borrower loan)) (err u403))
    (asserts! (is-eq (get status loan) "active") (err u400))
    (asserts! (<= payment-number (get total-payments loan)) (err u400))

    (map-set payments
      { loan-id: loan-id, payment-number: payment-number }
      {
        amount: amount,
        date: block-height,
        status: "completed"
      }
    )

    (map-set loans
      { loan-id: loan-id }
      (merge loan { payments-made: payment-number })
    )

    ;; If all payments made, close the loan
    (if (is-eq payment-number (get total-payments loan))
      (close-loan loan-id)
      (ok true)
    )
  )
)

(define-public (close-loan (loan-id uint))
  (let (
    (loan (unwrap! (get-loan loan-id) (err u404)))
  )
    (asserts! (or
      (is-eq tx-sender (get lender loan))
      (is-eq tx-sender (get borrower loan))
    ) (err u403))

    (map-set loans
      { loan-id: loan-id }
      (merge loan { status: "closed" })
    )

    ;; Release collateral
    (contract-call? .asset-registration update-asset-status (get asset-id loan) "available")
    (contract-call? .collateral-monitoring release-collateral (get asset-id loan))

    (ok true)
  )
)

(define-read-only (get-loan (loan-id uint))
  (map-get? loans { loan-id: loan-id })
)

(define-read-only (get-payment (loan-id uint) (payment-number uint))
  (map-get? payments { loan-id: loan-id, payment-number: payment-number })
)
