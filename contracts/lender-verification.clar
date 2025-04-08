;; Lender Verification Contract
;; Validates qualified financial institutions

(define-map verified-lenders
  { lender: principal }
  {
    name: (string-ascii 100),
    license-id: (string-ascii 50),
    verification-date: uint,
    is-active: bool
  }
)

(define-constant contract-owner tx-sender)

(define-public (register-lender
    (lender principal)
    (name (string-ascii 100))
    (license-id (string-ascii 50)))
  (begin
    (asserts! (is-eq tx-sender contract-owner) (err u403))
    (map-set verified-lenders
      { lender: lender }
      {
        name: name,
        license-id: license-id,
        verification-date: block-height,
        is-active: true
      }
    )
    (ok true)
  )
)

(define-public (deactivate-lender (lender principal))
  (let ((lender-data (unwrap! (get-lender-data lender) (err u404))))
    (asserts! (is-eq tx-sender contract-owner) (err u403))
    (map-set verified-lenders
      { lender: lender }
      (merge lender-data { is-active: false })
    )
    (ok true)
  )
)

(define-public (reactivate-lender (lender principal))
  (let ((lender-data (unwrap! (get-lender-data lender) (err u404))))
    (asserts! (is-eq tx-sender contract-owner) (err u403))
    (map-set verified-lenders
      { lender: lender }
      (merge lender-data { is-active: true })
    )
    (ok true)
  )
)

(define-read-only (get-lender-data (lender principal))
  (map-get? verified-lenders { lender: lender })
)

(define-read-only (is-verified-lender (lender principal))
  (let ((lender-data (get-lender-data lender)))
    (if (is-some lender-data)
      (get is-active (unwrap! lender-data false))
      false
    )
  )
)
