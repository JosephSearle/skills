/**
 * Architecture fitness functions — enforces structural rules on the dependency graph.
 *
 * Run with:
 *   Jest:   npx jest --testPathPattern="arch"
 *   Vitest: npx vitest run --reporter=verbose (filter by filename)
 *
 * VITEST 4 NOTE: toPassAsync() has a known bug on Vitest 4.x.
 * Use the rule.check() fallback pattern (shown in comments below) if you hit:
 *   TypeError: (0 , common_1.guessLocationOfTsconfig) is not a function
 */

import { projectFiles, metrics, projectSlices } from 'archunit';

// ---------------------------------------------------------------------------
// 1. CYCLE FREEDOM
// ---------------------------------------------------------------------------

it('src has no dependency cycles', async () => {
  const rule = projectFiles()
    .inFolder('src/**')      // TODO: adjust to your source root if different
    .should()
    .haveNoCycles();

  // Jest / Vitest (≤3):
  await expect(rule).toPassAsync();

  // Vitest 4 fallback (uncomment if toPassAsync throws TypeError):
  // const violations = await rule.check();
  // expect(violations).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// 2. LAYER BOUNDARY (deny-list pattern)
//    Replace the folder paths below with your actual layer names.
// ---------------------------------------------------------------------------

it('domain layer must not depend on infrastructure', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')          // TODO: replace with your inner-layer path
    .shouldNot()
    .dependOnFiles()
    .inFolder('src/infrastructure/**'); // TODO: replace with your outer-layer path

  await expect(rule).toPassAsync();
});

// ---------------------------------------------------------------------------
// 3. FRAMEWORK ISOLATION
//    Keeps the domain/core layer portable and unit-testable without framework deps.
//    Add one block per framework package present in your project.
// ---------------------------------------------------------------------------

it('domain must not import framework packages', async () => {
  const rule = projectFiles()
    .inFolder('src/domain/**')          // TODO: replace with your domain/core path
    .shouldNot()
    .dependOnFiles()
    .matchingPattern('**/node_modules/@nestjs/**'); // TODO: adjust package pattern

  await expect(rule).toPassAsync();
});

// ---------------------------------------------------------------------------
// 4. METRICS — code quality fitness functions
//    Uncomment and tune thresholds to your project's standards.
// ---------------------------------------------------------------------------

// it('domain classes should stay on the main sequence', async () => {
//   const rule = metrics()
//     .inFolder('src/domain/**')        // TODO: replace with your domain/core path
//     .distance()
//     .distanceFromMainSequence()
//     .shouldBeBelow(0.3);
//   await expect(rule).toPassAsync();
// });

// it('use cases / services should be cohesive', async () => {
//   const rule = metrics()
//     .inFolder('src/application/**')   // TODO: replace with your use-case layer
//     .lcom()
//     .lcom96b()
//     .shouldBeBelow(0.5);
//   await expect(rule).toPassAsync();
// });

// it('infrastructure files should not be too large', async () => {
//   const rule = metrics()
//     .inFolder('src/infrastructure/**') // TODO: replace with your infra layer
//     .count()
//     .linesOfCode()
//     .shouldBeBelow(500);
//   await expect(rule).toPassAsync();
// });

// ---------------------------------------------------------------------------
// 5. DIAGRAM ADHERENCE (optional — requires a PlantUML component diagram)
// ---------------------------------------------------------------------------

// it('slices must adhere to the component diagram', async () => {
//   const rule = projectSlices()
//     .definedBy('src/(**)/')
//     .should()
//     .adhereToDiagramInFile('docs/architecture/components.puml'); // TODO: verify path
//   await expect(rule).toPassAsync();
// });
