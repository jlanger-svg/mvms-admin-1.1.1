# Mills Campus Vehicle Tracker — Administrator

Version 1.1 adds audited editing for descriptive vehicle details including VIN, stock, year, make, model, trim, colours, plate, packages and specifications. Location and custody fields remain locked to mobile scans. Run `ADMIN-VEHICLE-EDIT-MIGRATION.sql` once in the Supabase SQL Editor before using the editor.

Protected desktop command centre for vehicle locations, custody history, users, login records, configuration, photos and exports.

Install the backend package first. Deploy the included `create-user` Edge Function before using User Management. Netlify build command: `npm run build`; publish directory: `dist`.
