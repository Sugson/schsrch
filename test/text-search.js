const supertest = require('supertest')
const should = require('should')
const PaperUtils = require('../view/paperutils.js')

module.exports = (schsrch, dbModel) =>
  describe('Full text search', function () {
    const {PastPaperDoc} = dbModel
    function ftExpectBasic (x) {
      return x.expect(res => res.body.list.forEach(x => x.should.be.an.Object()))
      .expect(res => res.body.list.forEach(x => x.doc.should.be.an.Object()))
      .expect(res => res.body.list.forEach(x => x.doc._id.should.be.a.String()))
      .expect(res => res.body.list.forEach(x => x.doc.fileType.should.equal('pdf')))
      .expect(res => res.body.list.forEach(x => should.not.exist(x.doc.doc)))
      .expect(res => res.body.list.forEach(x => x.index.should.be.an.Object()))
      .expect(res => res.body.list.forEach(x => x.index._id.should.be.an.String()))
      .expect(res => res.body.list.forEach(x => x.index.doc.should.be.an.String()))
      .expect(res => res.body.list.forEach(x => x.index.page.should.be.an.Number().and.aboveOrEqual(0)))
      .expect(res => res.body.list.forEach(x => should.not.exist(x.index.sspdfCache)))
    }
    let indexToSearch = null
    let tDocId = null
    function coldWife(done, itx) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/' + encodeURIComponent(itx ? itx : 'cold wife'))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(1, `Response should have one result returned.`)))
        .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
        .expect(res => res.body.list[0].str.should.equal('0610_s16_1_0_qp'))
        .expect(res => res.body.list[0].related.should.be.an.Array())
        .expect(res => res.body.list[0].related.should.have.length(1))
        .expect(res => res.body.list[0].related[0].should.be.an.Object())
        .expect(res => res.body.list[0].related[0]._id.should.be.a.String())
        .expect(res => res.body.list[0].related[0].type.should.equal('ms'))
        .expect(res => res.body.list[0].related[0].numPages.should.equal(1))
        .expect(res => res.body.list[0].related[0].fileType.should.equal('pdf'))
        .expect(res => should.not.exist(res.body.list[0].related[0].doc))
        .expect(res => should.not.exist(res.body.list[0].related[0].sspdfCache))
        .expect(res => indexToSearch = res.body.list[0].index._id)
        .expect(res => tDocId = res.body.list[0].doc._id)
        .end(done)
    }
    it('Case: cold wife', function (done) {
      coldWife(done)
    })
    it('Case: turn shout', function (done) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/' + encodeURIComponent('turn shout'))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(1, `Response should have one result returned.`)))
        .expect(res => res.body.list = res.body.list.map(x => Object.assign(x, {str: `${PaperUtils.setToString(x.doc)}_${x.doc.type}`})))
        .expect(res => res.body.list[0].str.should.equal('0611_s16_9_0_ms'))
        .expect(res => res.body.list[0].related.should.be.an.Array())
        .expect(res => res.body.list[0].related.should.have.length(0))
        .end(done)
    })
    it('Case: (space)', function (done) {
      ftExpectBasic(
        supertest(schsrch)
          .get('/search/' + encodeURIComponent(' '))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(0, `Response should have no results returned.`)))
        .end(done)
    })
    it('Case: !!index!...', function (done) {
      indexToSearch.should.be.a.String()
      coldWife(done, '!!index!' + indexToSearch)
    })
    function ftExpectEmpty (req) {
      return ftExpectBasic(req)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.response.should.equal('text', 'Response should be "text" type'))
        .expect(res => res.body.list.should.be.an.Array())
        .expect(res => res.body.list.length.should.equal(0, `Response should have no results returned.`))
    }
    it('Case: !!index!000000000000000000000000' , function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/' + encodeURIComponent('!!index!000000000000000000000000'))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
      ).end(done)
    })
    it("Shouldn't return the result if the corrospounding doc disappeared", function (done) {
      PastPaperDoc.remove({_id: tDocId}).then(() => {
        ftExpectEmpty(
          supertest(schsrch)
            .get('/search/' + encodeURIComponent('cold wife'))
            .set('Host', 'schsrch.xyz')
            .expect('Content-Type', /json/)
            .expect(200)
        ).end(done)
      }, err => done(err))
    })
    it("Shouldn't return !!index result if the corrospounding doc disappeared" , function (done) {
      ftExpectEmpty(
        supertest(schsrch)
          .get('/search/' + encodeURIComponent('!!index!' + indexToSearch))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
      ).end(done)
    })
  })
