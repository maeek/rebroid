import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { parseCommandLine } from "./command-line";

describe("parseCommandLine", () => {
  it("parses simple arguments", () => {
    assert.deepEqual(parseCommandLine("a b  c"), ["a", "b", "c"]);
  });

  it("parses quoted and escaped args", () => {
    assert.deepEqual(parseCommandLine('foo="bar baz" abc\\ def'), [
      "foo=bar baz",
      "abc def",
    ]);
  });

  it("returns undefined for empty input", () => {
    assert.equal(parseCommandLine("   "), undefined);
  });

  it("keeps quoted segments and escapes outside quotes", () => {
    assert.deepEqual(
      parseCommandLine('run "hello world" foo\\ bar baz\\ bar'),
      ["run", "hello world", "foo bar", "baz bar"],
    );
  });

  it("supports repeated single/double quote fragments", () => {
    assert.deepEqual(parseCommandLine('"foo" \'bar\' "ba"z'), [
      "foo",
      "bar",
      "baz",
    ]);
  });
});
