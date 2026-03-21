'use strict';

const { initializeApp } = require('firebase-admin/app');
const { FieldValue, Timestamp, getFirestore } = require('firebase-admin/firestore');

initializeApp();

const db = getFirestore();

module.exports = {
  db,
  FieldValue,
  Timestamp,
};
