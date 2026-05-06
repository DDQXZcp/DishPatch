# Modifying Data Structure

When we modify data structure, we need consider backward capability. The following methods are recommended. This will prevent crashing the system.

- Step 1 - Add new field to column
- Step 2 - Modify code to point to the new column
- Step 3 - Remove the old column in data.