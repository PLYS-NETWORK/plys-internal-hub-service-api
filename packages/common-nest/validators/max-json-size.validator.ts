import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// Cheap byte-size guard for free-form JSONB fields (Tiptap docs, FE-derived
// summaries, etc.). Walks once via JSON.stringify — O(n) — and rejects
// anything beyond `maxBytes`. Layered after `@IsObject` so the value is
// already known to be serialisable.
export function MaxJsonSize(maxBytes: number, validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'maxJsonSize',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      constraints: [maxBytes],
      validator: {
        validate(value: unknown, args: ValidationArguments): boolean {
          if (value === null || value === undefined) return true;
          // JSON.stringify rejects functions / symbols / circular structures
          // by returning undefined or throwing. Treat both as a fail closed.
          let serialised: string;
          try {
            serialised = JSON.stringify(value) ?? '';
          } catch {
            return false;
          }
          return Buffer.byteLength(serialised, 'utf8') <= (args.constraints[0] as number);
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} exceeds maximum JSON size of ${args.constraints[0]} bytes`;
        },
      },
    });
  };
}
