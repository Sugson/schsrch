const supertest = require('supertest')
const should = require('should')
const PaperUtils = require('../view/paperutils.js')

module.exports = schsrch =>
  describe('Search for specific paper', function () {
    function pplTest (query, expect) {
      it(query, function (done) {
        expect = expect.sort().map(x => `0610_${x}`)
        supertest(schsrch)
          .get('/search/' + encodeURIComponent(query))
          .set('Host', 'schsrch.xyz')
          .expect('Content-Type', /json/)
          .expect(200)
          .expect(res => res.body.should.be.an.Object())
          .expect(res => res.body.response.should.equal('pp', 'Response should be "pp" type'))
          .expect(res => res.body.list.should.be.an.Array())
          .expect(res => res.body.list.length.should.equal(expect.length, `Response should have ${expect.length} results returned.`))
          .expect(res => res.body.list = res.body.list.map(x => `${PaperUtils.setToString(x)}_${x.type}`))
          .expect(res => res.body.list = res.body.list.sort())
          .expect(res => res.body.list.forEach((x, idx) => x.should.equal(expect[idx])))
          .end(done)
      })
    }
    pplTest('0609', [])
    pplTest('0609 s16', [])
    pplTest('0609s16', [])
    ;['0610 ', '0610'].forEach(s => {
      pplTest(s, ['s08_1_0_qp', 's16_1_0_ms', 's16_1_0_qp', 's16_2_0_ms', 's16_2_0_qp', 's17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp', 'w16_1_1_qp', 'w16_1_1_ms'])

      pplTest(s + 's16', ['s16_1_0_ms', 's16_1_0_qp', 's16_2_0_ms', 's16_2_0_qp'])
      pplTest(s + 's17', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's18', [])
      pplTest(s + 'w16', ['w16_1_1_qp', 'w16_1_1_ms'])
      pplTest(s + 'w17', [])
      pplTest(s + 'y17', [])

      pplTest(s + 'y17 11', [])
      pplTest(s + 's16 13', [])
      pplTest(s + 's16 3', [])
      pplTest(s + 'w16 3', [])
      pplTest(s + 's16 1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's161', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's1610', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's17 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's1711', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's171', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])

      pplTest(s + '1', ['s08_1_0_qp', 's16_1_0_ms', 's16_1_0_qp', 's17_1_1_ms', 's17_1_1_qp', 's17_1_2_qp', 's17_1_2_ms', 'w16_1_1_qp', 'w16_1_1_ms'])
      pplTest(s + 'p1', ['s08_1_0_qp', 's16_1_0_ms', 's16_1_0_qp', 's17_1_1_ms', 's17_1_1_qp', 's17_1_2_qp', 's17_1_2_ms', 'w16_1_1_qp', 'w16_1_1_ms'])
      pplTest(s + 'paper 1', ['s08_1_0_qp', 's16_1_0_ms', 's16_1_0_qp', 's17_1_1_ms', 's17_1_1_qp', 's17_1_2_qp', 's17_1_2_ms', 'w16_1_1_qp', 'w16_1_1_ms'])
      pplTest(s + '11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 'p11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 'paper 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + '0', [])
      pplTest(s + 'p0', [])
      pplTest(s + 'paper 0', [])

      pplTest(s + 'y17 paper 11', [])
      pplTest(s + 's16 paper 13', [])
      pplTest(s + 's16 paper 3', [])
      pplTest(s + 'w16 paper 3', [])
      pplTest(s + 's16 paper 1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 'y17 paper11', [])
      pplTest(s + 's16 paper13', [])
      pplTest(s + 's16 paper3', [])
      pplTest(s + 'w16 paper3', [])
      pplTest(s + 's16 paper1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 'y17paper 11', [])
      pplTest(s + 's16paper 13', [])
      pplTest(s + 's16paper 3', [])
      pplTest(s + 'w16paper 3', [])
      pplTest(s + 's16paper 1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 'y17paper11', [])
      pplTest(s + 's16paper13', [])
      pplTest(s + 's16paper3', [])
      pplTest(s + 'w16paper3', [])
      pplTest(s + 's16paper1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16p1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 p1', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 paper 10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 paper10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16paper 10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16paper10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16p10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's16 p10', ['s16_1_0_ms', 's16_1_0_qp'])
      pplTest(s + 's17 paper 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 paper11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17paper 11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17paper11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17p11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 p11', ['s17_1_1_ms', 's17_1_1_qp'])
      pplTest(s + 's17 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17 paper 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17 paper1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17paper 1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17paper1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17p1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])
      pplTest(s + 's17 p1', ['s17_1_1_ms', 's17_1_1_qp', 's17_1_2_ms', 's17_1_2_qp'])

      pplTest(s + 's16 1 ms', ['s16_1_0_ms'])
      pplTest(s + 's161qp', ['s16_1_0_qp'])
      pplTest(s + 's16 10 ms', ['s16_1_0_ms'])
      pplTest(s + 's1610qp', ['s16_1_0_qp'])
      pplTest(s + 's17 11 ms', ['s17_1_1_ms'])
      pplTest(s + 's1711qp', ['s17_1_1_qp'])
      pplTest(s + 's17 1 ms', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's171qp', ['s17_1_1_qp', 's17_1_2_qp'])

      pplTest(s + 's16 paper 1 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 paper1 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 p1qp', ['s16_1_0_qp'])
      pplTest(s + 's16 paper 10 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 paper10 ms', ['s16_1_0_ms'])
      pplTest(s + 's16 p10qp', ['s16_1_0_qp'])
      pplTest(s + 's17 paper 11 ms', ['s17_1_1_ms'])
      pplTest(s + 's17 paper11 ms', ['s17_1_1_ms'])
      pplTest(s + 's17 p11qp', ['s17_1_1_qp'])
      pplTest(s + 's17 paper 1 ms', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's17 paper1 ms', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's17 p1qp', ['s17_1_1_qp', 's17_1_2_qp'])

      pplTest(s + 's16 ms 1', ['s16_1_0_ms'])
      pplTest(s + 's16qp1', ['s16_1_0_qp'])
      pplTest(s + 's16 ms 10', ['s16_1_0_ms'])
      pplTest(s + 's16qp10', ['s16_1_0_qp'])
      pplTest(s + 's17 ms 11', ['s17_1_1_ms'])
      pplTest(s + 's17qp11', ['s17_1_1_qp'])
      pplTest(s + 's17 ms 1', ['s17_1_1_ms', 's17_1_2_ms'])
      pplTest(s + 's17qp1', ['s17_1_1_qp', 's17_1_2_qp'])

      pplTest(s + 's08', ['s08_1_0_qp'])
      pplTest(s + 's8', ['s08_1_0_qp'])
      pplTest(s + 's8p1', ['s08_1_0_qp'])
      pplTest(s + 's8 paper 1', ['s08_1_0_qp'])
      pplTest(s + 's8 1 qp', ['s08_1_0_qp'])
      pplTest(s + 's8 10', ['s08_1_0_qp'])
      pplTest(s + 's8 10 qp', ['s08_1_0_qp'])
    })

    pplTest('0610/11/M/J/17', ['s17_1_1_ms', 's17_1_1_qp'])
    pplTest('0610/01/M/J/16', ['s16_1_0_ms', 's16_1_0_qp'])
    pplTest('0610/10/M/J/16', ['s16_1_0_ms', 's16_1_0_qp'])
    pplTest('0610/11/M/J/16', [])
    pplTest('0610/11/O/N/16', ['w16_1_1_qp', 'w16_1_1_ms'])
    pplTest('0610/10/O/N/16', [])
    pplTest('0610/01/O/N/16', [])

    it('Overflow result', function (done) {
      supertest(schsrch)
        .get('/search/0611')
        .set('Host', 'schsrch.xyz')
        .expect('Content-Type', /json/)
        .expect(200)
        .expect(res => res.body.should.be.an.Object())
        .expect(res => res.body.response.should.equal('overflow', 'Response should be "overflow" type'))
        .expect(res => should.not.exist(res.body.list))
        .end(done)
    })
  })
