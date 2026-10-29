"""Scene script for the ReplayGuard walkthrough (~5 minutes).

One tuple per scene: (id, actions, narration). Written for the Rivet team and for engineers who
run durable workflows; it describes the product, not the person who built it. Every number spoken
here is what the demo, the test suites or the reproductions actually produce.

Actions are interpreted by record.py:
  ("card", "<card id>")             show a card from cards.html
  ("term", "<act id>")              show a captured `pnpm demo` act from terminal.html
  ("report", "<file>", "<css>", z)  open a real HTML report at page zoom z, centred on that element
  ("zoom", "<css selector>", s)     animate a zoom onto that element
  ("unzoom",)                       ease back to 1.0
  ("point", "<css selector>")       move the on-screen cursor onto an element
  ("scroll", <px>)                  smooth scroll by px
  ("wait", <seconds>)               hold

Roughly 180 words of narration costs a minute of video.
"""

SCENES = [
 ("title", [("card", "title"), ("wait", 0.6)],
  "This is ReplayGuard: a test harness for Rivet workflows that answers one question. "
  "When your workflow crashes, retries or times out, does it charge the card twice, send the email twice, "
  "or quietly skip it? "
  "Everything in this walkthrough is the running code, on the real Rivet engine."),

 ("problem", [("card", "problem"), ("wait", 0.4)],
  "Durable workflows make your code survive crashes by replaying steps from history. "
  "But the history is written after a step finishes. "
  "If the process dies after the payment provider has charged the card, and before the step result is saved, "
  "the step runs again on restart, and the customer is charged twice. "
  "That is correct at-least-once behaviour, and it is documented. "
  "What is missing is a way to test for it before production finds it for you."),

 ("how", [("card", "how"), ("wait", 0.4)],
  "ReplayGuard wraps each external call, so every attempt is recorded in an effect ledger. "
  "It then runs the workflow again and again, injecting one fault per case: a crash just after a call, "
  "a lost response, a lost request, a hanging provider, or a real process kill. "
  "It restarts the workflow the way a host would, and classifies every effect into one of six outcomes, "
  "from exactly once and deduplicated, to duplicated, concurrent duplicate, orphaned, or skipped."),

 ("code", [("card", "code"), ("wait", 0.4)],
  "Here is the demo workflow. Two steps: charge the card, then email a receipt. "
  "The payment and email services are ReplayGuard fakes that behave like real providers. "
  "The payment fake honours idempotency keys; the email fake, like most email, does not. "
  "One call to explore, and ReplayGuard generates the fault cases for us: "
  "a crash or a lost response, before or after each call. Eight cases."),

 ("act1", [("term", "act1"), ("wait", 0.6)],
  "Act one: the checkout as written. The verdict is fail. "
  "Four of the eight cases apply an effect twice. "
  "Each row is a case and an effect, with its outcome and verdict. "
  "Below the table, ReplayGuard explains why, in plain words: the crash stopped run zero after the charge applied "
  "but before the step result was saved, so run one re-executed the step. "
  "And it suggests the fix, with code."),

 ("report", [("report", "demo-1.html", "#case-1 svg.rg-timeline", 1.7)],
  "The same result as a self-contained HTML report. "
  "This timeline is the crash case. One lane per run. "
  "The charge bar in run zero, the dashed red line where the fault fired, and the same charge again in run one. "
  "The report has no external requests and a strict content security policy, so it can be attached to a pull "
  "request or a CI run as it is."),

 ("fix", [("card", "fix"), ("wait", 0.4)],
  "Act two is one line. Pass a stable idempotency key, derived from the workflow ID and the step name, "
  "so a re-executed step sends the same key. "
  "Never a timestamp or an attempt number: those change on every retry."),

 ("act2", [("term", "act2"), ("wait", 0.6)],
  "Run it again. Every payment row is now deduplicated or exactly once: the provider recognised the replay. "
  "But the verdict is still fail, because the receipt email is still sent twice. "
  "Email providers have no idempotency key, and ReplayGuard will not pretend otherwise. "
  "This time the hint is a decision, not a code change."),

 ("act3", [("term", "act3"), ("wait", 0.6)],
  "Act three. If an occasional repeated receipt is acceptable, say so in the verdict policy. "
  "Duplicated receipts become a warning, payments stay strict. "
  "Fail, fail, warn: the workflow went from silently double charging to an explicit, reviewed trade-off, "
  "and that policy now lives in the test."),

 ("runtimes", [("card", "runtimes"), ("wait", 0.4)],
  "The same scenarios run on three runtimes. "
  "The Rivet workflow engine in process, which is fast. "
  "The engine in a child process that is killed for real at the fault. "
  "And real RivetKit workflow actors: the host is killed with SIGKILL, the engine moves the actor to a new host, "
  "and the workflow resumes from its persisted history. "
  "A shared conformance suite checks that all three classify the same six scenarios identically, "
  "on RivetKit two point three point eleven and two point three point twenty seven."),

 ("findings", [("card", "findings"), ("wait", 0.4)],
  "Building this surfaced three engine behaviours worth a design discussion, each with a standalone reproduction. "
  "A crash during a step is not counted against max retries: with max retries of two, a crash loop ran the "
  "charge six times. "
  "A step timeout does not cancel the call, so a timed-out charge still lands, even after the workflow has failed. "
  "And inside a step there is no stable identity to build idempotency keys from, so two loop iterations derive "
  "the same key. "
  "It also found that RivetKit two point three has no working Windows runtime, for packaging reasons."),

 ("use", [("card", "use"), ("wait", 0.4)],
  "In practice it is a test. Vitest matchers like to pass side effect policy and to be effectively once "
  "run the exploration in CI, and fail the build with the explanation in the message. "
  "Reports go to the console or to HTML, and fakes cover payments, email, HTTP and webhooks."),

 ("close", [("card", "close"), ("wait", 0.6)],
  "ReplayGuard is open source under Apache two. "
  "The repository has the demo, the reproductions and the specs behind every feature. "
  "Feedback on the three proposals is very welcome, and so is the question of where a tool like this belongs "
  "in the Rivet ecosystem. "
  "Thanks for watching."),
]
