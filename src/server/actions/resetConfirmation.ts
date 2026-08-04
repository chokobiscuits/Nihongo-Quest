/// The literal string a caller must supply to confirm a destructive reset.
///
/// Lives in its own module rather than alongside resetProgress because a
/// "use server" file may only export async functions — exporting a plain
/// const from one makes the entire module invalid and silently strips every
/// export, including the action itself. Importable from both the server
/// action and the client component.
export const RESET_CONFIRMATION = "RESET";
