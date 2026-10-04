# Doctor Profile

`DoctorProfile` is a one-to-one specialization of `Provider`. It contains the medical council number and reusable `MedicalSpecialty` relation; it has no National ID field. A provider owner's account National ID, when collected, remains in `UserProfile` and is not copied into `Provider` or `DoctorProfile`. Self-registration creates `PENDING_REVIEW`; only permissioned administration can approve it. Public provider projections omit the medical council number and membership/authentication data.
