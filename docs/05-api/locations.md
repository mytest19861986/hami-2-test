# Locations API

- `GET /api/v1/locations/provinces`
- `GET /api/v1/locations/provinces/:id/cities`

An unknown province returns `404`. Address creation and update independently verify that the selected city belongs to the selected province.
