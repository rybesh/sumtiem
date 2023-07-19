const { build, context } = require("esbuild")

const options = {

  bundle: true,
  entryPoints: ["src/index.ts"],
  outdir: "www",
  platform: "browser",
  sourcemap: true,
  target: ["safari16"],
  external: ["path", "fs"],

}

async function serve() {
  let ctx = await context(options)

  await ctx.watch()

  let { host, port } = await ctx.serve({
    servedir: "www",
  })
  console.log(`listening on ${host}:${port}`)
}

let args = process.argv.slice(2)

if (args.length > 0 && args[0] == "serve") {
  serve()
} else {
  build(options).catch(() => process.exit(1))
}
