# Doctor Profile

`DoctorProfile` is a one-to-one specialization of `Provider`. It contains the medical council number and reusable `MedicalSpecialty` relation. Self-registration creates `PENDING_REVIEW`; only permissioned administration can approve it.
