# ADR-0003: Generic Provider Core vs Doctor-specific Core

## Decision

Use a generic `Provider` core and a one-to-one `DoctorProfile` specialization. Geography, lifecycle status, public directory filtering, and membership remain generic. Medical council number and specialty remain Doctor-specific.

## Rationale

This keeps Doctor as the first vertical without hard-coding future Pharmacy, Laboratory, Clinic, Store, or other provider types into the core schema.
