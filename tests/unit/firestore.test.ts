import { describe, it, beforeEach, afterEach } from 'vitest';
import {
  initializeTestEnvironment,
  RulesTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import * as fs from 'fs';
import * as path from 'path';

let testEnv: RulesTestEnvironment;

beforeEach(async () => {
  try {
    testEnv = await initializeTestEnvironment({
      projectId: 'trend-equity-test',
      firestore: {
        rules: fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8'),
      },
    });
  } catch (error) {
    // Emulator not running - tests will be skipped
  }
});

afterEach(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

describe.skipIf(!testEnv)('Firestore Security Rules', () => {
  describe('users/{uid} collection', () => {
    const uid = 'user123';
    const otherUid = 'user456';

    it('allows user to read their own doc', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertSucceeds(db.collection('users').doc(uid).get());
    });

    it('denies user reading another user doc', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(db.collection('users').doc(otherUid).get());
    });

    it('allows user to create own doc with safe fields', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertSucceeds(
        db.collection('users').doc(uid).set({
          filters: {},
          updatedAt: new Date(),
        })
      );
    });

    it('denies user writing tier field on create', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('users').doc(uid).set({
          tier: 'builder',
          filters: {},
        })
      );
    });

    it('denies user writing role field on create', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('users').doc(uid).set({
          role: 'admin',
          filters: {},
        })
      );
    });

    it('denies user updating tier field', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      // First create a doc as admin
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc(uid).set({
          tier: 'free',
          role: 'user',
          filters: {},
        });
      });
      // Now try to update tier as user
      await assertFails(
        db.collection('users').doc(uid).update({
          tier: 'builder',
        })
      );
    });

    it('denies user updating role field', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc(uid).set({
          tier: 'free',
          role: 'user',
          filters: {},
        });
      });
      await assertFails(
        db.collection('users').doc(uid).update({
          role: 'admin',
        })
      );
    });

    it('allows user updating filters field', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('users')
          .doc(uid)
          .set({
            tier: 'free',
            filters: { category: 'ai' },
          });
      });
      await assertSucceeds(
        db
          .collection('users')
          .doc(uid)
          .update({
            filters: { category: 'web3' },
          })
      );
    });

    it('denies unauthenticated user', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(db.collection('users').doc(uid).get());
    });
  });

  describe('user_saves/{saveId} collection', () => {
    const uid = 'user123';
    const saveId = 'save456';

    it('allows user to read own saves', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('user_saves')
          .doc(saveId)
          .set({
            userId: uid,
            idea: { id: 'idea1', headline: 'test' },
            savedAt: new Date(),
          });
      });
      await assertSucceeds(db.collection('user_saves').doc(saveId).get());
    });

    it('denies user reading saves from another user', async () => {
      const otherUid = 'user789';
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('user_saves')
          .doc(saveId)
          .set({
            userId: otherUid,
            idea: { id: 'idea1' },
          });
      });
      await assertFails(db.collection('user_saves').doc(saveId).get());
    });

    it('allows user to create own save', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertSucceeds(
        db
          .collection('user_saves')
          .doc(saveId)
          .set({
            userId: uid,
            idea: { id: 'idea1', headline: 'test' },
            savedAt: new Date(),
          })
      );
    });

    it('denies user creating save for another user', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db
          .collection('user_saves')
          .doc(saveId)
          .set({
            userId: 'user456',
            idea: { id: 'idea1' },
          })
      );
    });

    it('allows user to delete own save', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('user_saves')
          .doc(saveId)
          .set({
            userId: uid,
            idea: { id: 'idea1' },
          });
      });
      await assertSucceeds(db.collection('user_saves').doc(saveId).delete());
    });

    it('denies user deleting save from another user', async () => {
      const otherUid = 'user789';
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('user_saves')
          .doc(saveId)
          .set({
            userId: otherUid,
            idea: { id: 'idea1' },
          });
      });
      await assertFails(db.collection('user_saves').doc(saveId).delete());
    });
  });

  describe('user_alerts/{alertId} collection', () => {
    const uid = 'user123';
    const alertId = 'alert456';

    it('allows user to read own alerts', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('user_alerts').doc(alertId).set({
          userId: uid,
          timestamp: new Date(),
          isRead: false,
        });
      });
      await assertSucceeds(db.collection('user_alerts').doc(alertId).get());
    });

    it('denies user reading alerts from another user', async () => {
      const otherUid = 'user789';
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('user_alerts').doc(alertId).set({
          userId: otherUid,
          timestamp: new Date(),
          isRead: false,
        });
      });
      await assertFails(db.collection('user_alerts').doc(alertId).get());
    });

    it('allows user to mark own alert as read', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('user_alerts').doc(alertId).set({
          userId: uid,
          timestamp: new Date(),
          isRead: false,
          message: 'test alert',
        });
      });
      await assertSucceeds(
        db.collection('user_alerts').doc(alertId).update({
          isRead: true,
        })
      );
    });

    it('denies updating multiple fields in alert', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('user_alerts').doc(alertId).set({
          userId: uid,
          timestamp: new Date(),
          isRead: false,
          message: 'test',
        });
      });
      await assertFails(
        db.collection('user_alerts').doc(alertId).update({
          isRead: true,
          message: 'hacked',
        })
      );
    });
  });

  describe('comments/{commentId} collection', () => {
    const uid = 'user123';
    const commentId = 'comment456';

    it('allows authenticated user to read comments', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('comments').doc(commentId).set({
          userId: 'user789',
          ideaId: 'idea1',
          text: 'great idea',
          timestamp: new Date(),
        });
      });
      await assertSucceeds(db.collection('comments').doc(commentId).get());
    });

    it('denies unauthenticated user reading comments', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('comments').doc(commentId).set({
          userId: 'user789',
          ideaId: 'idea1',
          text: 'great idea',
          timestamp: new Date(),
        });
      });
      await assertFails(db.collection('comments').doc(commentId).get());
    });

    it('allows authenticated user to create comment', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertSucceeds(
        db.collection('comments').doc(commentId).set({
          userId: uid,
          ideaId: 'idea1',
          text: 'great idea',
          timestamp: new Date(),
        })
      );
    });

    it('denies user creating comment with different userId', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('comments').doc(commentId).set({
          userId: 'user456',
          ideaId: 'idea1',
          text: 'great idea',
        })
      );
    });

    it('allows user to delete own comment', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('comments').doc(commentId).set({
          userId: uid,
          ideaId: 'idea1',
          text: 'great idea',
        });
      });
      await assertSucceeds(db.collection('comments').doc(commentId).delete());
    });

    it('denies user deleting comment from another user', async () => {
      const otherUid = 'user789';
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('comments').doc(commentId).set({
          userId: otherUid,
          ideaId: 'idea1',
          text: 'great idea',
        });
      });
      await assertFails(db.collection('comments').doc(commentId).delete());
    });
  });

  describe('server-only collections', () => {
    const uid = 'user123';
    const serverOnlyCollections = [
      'api_usage',
      'api_cache',
      'daily_generations_history',
      'locks',
      'idea_embeddings',
      'idea_predictions',
      'idea_stats',
      'prompt_history',
      'config',
    ];

    serverOnlyCollections.forEach((collection) => {
      it(`denies authenticated user reading ${collection}`, async () => {
        const db = testEnv.authenticatedContext(uid).firestore();
        await assertFails(db.collection(collection).doc('doc1').get());
      });

      it(`denies authenticated user writing to ${collection}`, async () => {
        const db = testEnv.authenticatedContext(uid).firestore();
        await assertFails(db.collection(collection).doc('doc1').set({ data: 'test' }));
      });

      it(`denies unauthenticated user reading ${collection}`, async () => {
        const db = testEnv.unauthenticatedContext().firestore();
        await assertFails(db.collection(collection).doc('doc1').get());
      });
    });
  });

  describe('daily_generations/{date} collection', () => {
    const uid = 'user123';
    const date = '2026-07-20';

    it('allows authenticated user to read daily_generations', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('daily_generations')
          .doc(date)
          .set({
            ideas: [{ id: 'idea1', headline: 'test' }],
            updatedAt: new Date(),
            public: true,
          });
      });
      await assertSucceeds(db.collection('daily_generations').doc(date).get());
    });

    it('denies unauthenticated user reading daily_generations', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('daily_generations')
          .doc(date)
          .set({
            ideas: [{ id: 'idea1' }],
            public: false,
          });
      });
      await assertFails(db.collection('daily_generations').doc(date).get());
    });

    it('denies authenticated user creating daily_generations', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('daily_generations').doc(date).set({
          ideas: [],
        })
      );
    });

    it('denies authenticated non-admin updating daily_generations', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('users').doc(uid).set({
          role: 'user',
          tier: 'free',
        });
        await context
          .firestore()
          .collection('daily_generations')
          .doc(date)
          .set({
            ideas: [{ id: 'idea1' }],
          });
      });
      await assertFails(
        db
          .collection('daily_generations')
          .doc(date)
          .update({
            ideas: [{ id: 'idea2' }],
          })
      );
    });
  });

  describe('enterprise_leads collection', () => {
    it('allows authenticated user to create lead', async () => {
      const uid = 'user123';
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertSucceeds(
        db.collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          company: 'ACME Inc',
          role: 'VC Partner',
          message: 'interested',
        })
      );
    });

    it('denies unauthenticated user creating lead', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await assertFails(
        db.collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          company: 'ACME Inc',
          role: 'VC Partner',
        })
      );
    });

    it('denies lead missing required fields', async () => {
      const uid = 'user123';
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          email: 'john@example.com',
          // missing lastName, company, role
        })
      );
    });

    it('denies lead with invalid email', async () => {
      const uid = 'user123';
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          lastName: 'Doe',
          email: 'not-an-email',
          company: 'ACME Inc',
          role: 'VC Partner',
        })
      );
    });

    it('denies lead trying to set createdAt', async () => {
      const uid = 'user123';
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db.collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          company: 'ACME Inc',
          role: 'VC Partner',
          createdAt: new Date(),
        })
      );
    });

    it('denies user reading leads', async () => {
      const uid = 'user123';
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          email: 'john@example.com',
        });
      });
      await assertFails(db.collection('enterprise_leads').doc('lead1').get());
    });

    it('denies user updating lead', async () => {
      const uid = 'user123';
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context.firestore().collection('enterprise_leads').doc('lead1').set({
          firstName: 'John',
          email: 'john@example.com',
        });
      });
      await assertFails(
        db.collection('enterprise_leads').doc('lead1').update({
          firstName: 'Jane',
        })
      );
    });
  });

  describe('app_config collection', () => {
    const uid = 'user123';

    it('allows authenticated user to read app_config', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('app_config')
          .doc('tier_limits')
          .set({
            analyze_idea_monthly: { pro: 5, builder: 20 },
          });
      });
      await assertSucceeds(db.collection('app_config').doc('tier_limits').get());
    });

    it('denies authenticated user writing to app_config', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await assertFails(
        db
          .collection('app_config')
          .doc('tier_limits')
          .set({
            analyze_idea_monthly: { pro: 100, builder: 1000 },
          })
      );
    });

    it('denies authenticated user deleting app_config', async () => {
      const db = testEnv.authenticatedContext(uid).firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('app_config')
          .doc('tier_limits')
          .set({
            analyze_idea_monthly: { pro: 5, builder: 20 },
          });
      });
      await assertFails(db.collection('app_config').doc('tier_limits').delete());
    });

    it('denies unauthenticated user reading app_config', async () => {
      const db = testEnv.unauthenticatedContext().firestore();
      await testEnv.withSecurityRulesDisabled(async (context) => {
        await context
          .firestore()
          .collection('app_config')
          .doc('tier_limits')
          .set({
            analyze_idea_monthly: { pro: 5, builder: 20 },
          });
      });
      await assertFails(db.collection('app_config').doc('tier_limits').get());
    });
  });
});
