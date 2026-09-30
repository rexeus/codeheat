# Changesets

Every pull request that changes what users of the `codeheat` package see — commands, flags, output, the JSON contract — adds a changeset:

```bash
pnpm changeset
```

Pick `codeheat`, choose the bump (breaking JSON contract changes are `major`), and describe the change for the changelog. Private workspace packages (`@codeheat/*`) are bundled into `codeheat` and never versioned on their own.
