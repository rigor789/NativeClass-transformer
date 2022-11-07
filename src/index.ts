import * as ts from "typescript";

// @NativeClass()
// class MyPlugin {}

// @NativeClass
// class MyPlugin {}

// @NativeClass({})
// class MyPlugin {}

const code = `
@NativeClass({
    /* cool */
    test: ['ok']
})
export class MyPlugin {
    test() {
        return 'hello';
    }
}
`;

/**
 * The transformer signature is based on https://github.com/cevek/ttypescript#program
 */
export function transformer() {
  return (context: ts.TransformationContext) => {
    let depth = 0;
    return (sourceFile: ts.SourceFile) => {
      function visitClassDeclaration(node: ts.ClassDeclaration) {
        const nonDecorators =
          node.modifiers?.filter((mod) => !ts.isDecorator(mod)) ?? [];
        const decorators =
          (ts
            .getDecorators(node)
            ?.map((dec) => {
              return visitDecorator(dec);
            })
            .filter(Boolean) as ts.Decorator[]) ?? [];

        depth++;
        const a = ts.factory.createPropertyDeclaration(
          [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)],
          "objcProtocols",
          undefined,
          undefined,
          ts.factory.createArrayLiteralExpression([
            ts.factory.createStringLiteral("foo"),
          ])
        );

        const updated = ts.visitEachChild(node, visitor, context);
        const cls = context.factory.updateClassDeclaration(
          updated,
          [...nonDecorators, ...decorators],
          updated.name,
          updated.typeParameters,
          updated.heritageClauses,
          [a, ...updated.members]
        );

        return cls;
      }

      function processDecorator(name: string, node: ts.Decorator, arg?: any) {
        depth++;
        if (name !== "NativeClass") return node;

        // ts.addSyntheticLeadingComment(
        //   node.parent,
        //   ts.SyntaxKind.MultiLineCommentTrivia,
        //   ` @NativeClass `
        // );

        // remove decorator
        return undefined;
      }

      function visitDecorator(node: ts.Decorator) {
        const decorator = node as ts.Decorator;
        const exp = decorator.expression;
        switch (exp.kind) {
          case ts.SyntaxKind.CallExpression: {
            const callExp = exp as ts.CallExpression;
            const name = callExp.expression.getText();

            const arg = callExp.arguments?.at(0);

            if (arg && ts.isObjectLiteralExpression(arg)) {
              //   console.log("with arg", arg.getText());
              return processDecorator(name, decorator, arg);
            }

            return processDecorator(name, decorator);
          }
          case ts.SyntaxKind.Identifier: {
            const idenExp = exp as ts.Identifier;
            const name = idenExp.getText();

            return processDecorator(name, decorator);
          }
        }
        return node;
      }

      const visitor: any = (node: ts.Node) => {
        depth++;
        console.log(
          `${"  ".repeat(depth - 1)} VISIT`,
          node.kind,
          ts.SyntaxKind[node.kind]
        );

        switch (node.kind) {
          case ts.SyntaxKind.ClassDeclaration: {
            const res = visitClassDeclaration(node as ts.ClassDeclaration);
            depth--;
            return res;
          }
          //   case ts.SyntaxKind.Decorator: {
          //     const res = visitDecorator(node as ts.Decorator);
          //     depth--;
          //     return res;
          //   }
        }

        const res = ts.visitEachChild(node, visitor, context);
        depth--;
        return res;
      };
      return ts.visitNode(sourceFile, visitor);
    };
  };
}

async function main() {
  console.log("Input:\n---------\n");
  console.log(code.trim());

  let result = ts.transpileModule(code, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ESNext,
      noEmitHelpers: true,
    },
    transformers: {
      before: [transformer()],
    },
  });

  console.log("\nResult:\n---------\n");
  console.log(result.outputText.trim());
  console.log("---------");
  //   console.log(JSON.stringify(result));
}

main().catch((err) => console.error(err));
